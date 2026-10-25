import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import {
  AD_UNLOCK_HOURS,
  hasRoleAtLeast,
  QUOTE_VALIDITY_DAYS,
  type QuoteFlag,
  type QuoteStatus,
} from "../../shared/domain";
import type { Db } from "../db/client";
import { adEvents, components, installerMargins, quoteCalcAudit, quotes, userProfiles } from "../db/schema";
import { ENGINE_VERSION, priceBom, type BomLine, type EngineResult, type LoadItem, type Pricing } from "../engine";
import type { SessionUser } from "../lib/context";
import { loadSettings } from "../lib/settings";
import { ApiError } from "../lib/http";

export type QuoteRow = typeof quotes.$inferSelect;

/** Guests may save a calculation they ran before signing in, within this window. */
const GUEST_CALC_CLAIM_HOURS = 24;
/** PRD §28.2: a ≥5% move on any BOM line flags the quote. */
const PRICE_CHANGE_THRESHOLD = 0.05;

const STATUS_ORDER: QuoteStatus[] = ["draft", "generated", "viewed", "expired"];

function base32(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

function newReference(now: Date): string {
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `PS-${ym}-${base32(randomBytes(6))}`;
}

function newShareToken(): string {
  return Buffer.from(randomBytes(24)).toString("base64url");
}

interface StoredInputs {
  request: { state: string };
  loads: LoadItem[];
}

/** Persists a quote from a stored calculation, re-priced at today's prices (PRD §28.1). */
export async function createQuote(
  db: Db,
  user: SessionUser,
  { calculationId, clientName }: { calculationId: string; clientName?: string },
): Promise<QuoteRow> {
  const [calc] = await db.select().from(quoteCalcAudit).where(eq(quoteCalcAudit.id, calculationId)).limit(1);
  const claimable =
    calc &&
    (calc.userId === user.id ||
      (calc.userId === null && Date.now() - calc.createdAt.getTime() < GUEST_CALC_CLAIM_HOURS * 3_600_000));
  if (!calc || !claimable) {
    throw new ApiError(404, "NOT_FOUND", "We couldn't find that calculation. Please calculate your system again.", "calculationId");
  }
  const result = calc.stepResults as EngineResult | { error: unknown };
  if ("error" in result) {
    throw new ApiError(400, "INVALID_PAYLOAD", "That calculation did not produce a system.", "calculationId");
  }
  // Sizing rules changed between engine versions; never quote a design made under old rules.
  if (calc.engineVersion !== ENGINE_VERSION) {
    throw new ApiError(409, "INVALID_PAYLOAD", "Our sizing method has been updated. Please calculate your system again.", "calculationId");
  }
  // Schematics §5: no final quote for a system that has not passed validation.
  if (!result.validation.quoteEligible) {
    throw new ApiError(422, "INVALID_PAYLOAD", "This system has not passed validation, so a quote can't be issued.", "calculationId");
  }
  const inputs = calc.inputs as StoredInputs;

  // Current prices; refuse if anything has gone out of stock since the calculation.
  const ids = result.bom.map((l) => l.componentId);
  const current = await db.select().from(components).where(inArray(components.id, ids));
  const byId = new Map(current.map((c) => [c.id, c]));
  const bom: BomLine[] = result.bom.map((line) => {
    const c = byId.get(line.componentId);
    if (!c || !c.isActive) {
      throw new ApiError(409, "NO_SKU_AVAILABLE", `${line.model} is no longer in stock. Please calculate your system again.`);
    }
    return { ...line, unitPriceNgn: c.unitPriceNgn };
  });

  const isInstaller = hasRoleAtLeast(user.role, "installer");
  const [margins] = isInstaller
    ? await db.select().from(installerMargins).where(eq(installerMargins.installerId, user.id)).limit(1)
    : [];
  const { pricing: pricingSettings } = await loadSettings(db);
  const pricing = priceBom(bom, {
    ...pricingSettings,
    marginPct: margins?.marginPct ?? 0,
    labourFlatFeeNgn: margins?.labourFlatFeeNgn ?? 0,
  });

  const now = new Date();
  const values = {
    userId: user.id,
    installerId: isInstaller ? user.id : null,
    clientName: clientName?.trim() || null,
    state: inputs.request.state,
    status: "generated" as const,
    inputs,
    result,
    bom,
    pricing,
    totalCostNgn: pricing.totalNgn,
    engineVersion: ENGINE_VERSION,
    calcAuditId: calc.id,
    expiresAt: new Date(now.getTime() + QUOTE_VALIDITY_DAYS * 86_400_000),
  };

  // References are random; retry on the (very unlikely) collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    const [row] = await db
      .insert(quotes)
      .values({ ...values, reference: newReference(now), shareToken: newShareToken() })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
  }
  throw new ApiError(500, "INTERNAL_ERROR", "Could not generate a quote reference. Please try again.");
}

/**
 * Brings status and flags up to date on read (PRD §28.2): expiry after 30 days,
 * PRICE_CHANGED on a ≥5% move, COMPONENT_UNAVAILABLE when a part is deactivated.
 * Status only moves forward; flags are only ever added.
 */
export async function refreshQuote(db: Db, quote: QuoteRow, opts: { markViewed?: boolean } = {}): Promise<QuoteRow> {
  const bom = quote.bom as BomLine[];
  const current = await db
    .select({ id: components.id, unitPriceNgn: components.unitPriceNgn, isActive: components.isActive })
    .from(components)
    .where(inArray(components.id, bom.map((l) => l.componentId)));
  const byId = new Map(current.map((c) => [c.id, c]));

  const flags = new Set(quote.flags as QuoteFlag[]);
  for (const line of bom) {
    const c = byId.get(line.componentId);
    if (!c || !c.isActive) flags.add("COMPONENT_UNAVAILABLE");
    else if (Math.abs(c.unitPriceNgn - line.unitPriceNgn) / line.unitPriceNgn >= PRICE_CHANGE_THRESHOLD) flags.add("PRICE_CHANGED");
  }

  let status = quote.status;
  const advance = (to: QuoteStatus) => {
    if (STATUS_ORDER.indexOf(to) > STATUS_ORDER.indexOf(status)) status = to;
  };
  if (opts.markViewed) advance("viewed");
  if (quote.expiresAt.getTime() <= Date.now()) advance("expired");

  const nextFlags = [...flags];
  if (status === quote.status && nextFlags.length === quote.flags.length) return quote;
  const [updated] = await db.update(quotes).set({ status, flags: nextFlags }).where(eq(quotes.id, quote.id)).returning();
  return updated ?? quote;
}

/** Pro (installer and above) bypass the ad gate; others need a completed ad in the last 24h. */
export async function isUnlocked(db: Db, quote: QuoteRow, user: SessionUser): Promise<boolean> {
  if (hasRoleAtLeast(user.role, "installer")) return true;
  const [event] = await db
    .select({ id: adEvents.id })
    .from(adEvents)
    .where(
      and(
        eq(adEvents.quoteId, quote.id),
        eq(adEvents.userId, user.id),
        isNotNull(adEvents.completedAt),
        gte(adEvents.completedAt, sql`now() - make_interval(hours => ${AD_UNLOCK_HOURS})`),
      ),
    )
    .limit(1);
  return !!event;
}

export async function preparedBy(db: Db, quote: QuoteRow): Promise<string | null> {
  if (!quote.installerId) return null;
  const [profile] = await db
    .select({ companyName: userProfiles.companyName })
    .from(userProfiles)
    .where(eq(userProfiles.userId, quote.installerId))
    .limit(1);
  return profile?.companyName ?? null;
}

/** Client-safe representation: system specs and prices, never load analysis or wattage (FR-003). */
export function quoteView(quote: QuoteRow, extras: { preparedBy: string | null; shareUrl?: string | null; unlocked?: boolean }) {
  const result = quote.result as EngineResult;
  const inputs = quote.inputs as StoredInputs;
  const pricing = quote.pricing as Pricing;
  return {
    id: quote.id,
    reference: quote.reference,
    clientName: quote.clientName,
    state: quote.state,
    status: quote.status,
    flags: quote.flags,
    createdAt: quote.createdAt.toISOString(),
    expiresAt: quote.expiresAt.toISOString(),
    preparedBy: extras.preparedBy,
    system: systemView(result),
    appliances: inputs.loads.map((l) => ({ name: l.name, quantity: l.quantity, dayHours: l.dayHours, nightHours: l.nightHours })),
    pricing: {
      lines: pricing.lines,
      equipmentSubtotalNgn: pricing.equipmentSubtotalNgn,
      // Quotes saved before installation fees existed have none.
      installationRate: pricing.installationRate ?? 0,
      installationFeeNgn: pricing.installationFeeNgn ?? 0,
      labourNgn: pricing.labourNgn,
      discountNgn: pricing.discountNgn ?? 0,
      vatNgn: pricing.vatNgn,
      vatRate: pricing.vatRate,
      totalNgn: pricing.totalNgn,
    },
    ...(extras.unlocked !== undefined ? { unlocked: extras.unlocked } : {}),
    ...(extras.shareUrl !== undefined ? { shareUrl: extras.shareUrl } : {}),
  };
}

export type QuoteView = ReturnType<typeof quoteView>;

export function systemView(r: EngineResult) {
  return {
    systemVoltage: r.systemVoltage,
    batteryChemistry: r.batteryChemistry,
    inverter: { model: r.inverter.inverter.model, kva: r.inverter.inverter.kva },
    battery: {
      model: r.battery.battery.model,
      units: r.battery.totalUnits,
      seriesCount: r.battery.seriesCount,
      parallelStrings: r.battery.parallelStrings,
      installedKwh: r.battery.installedKwh,
    },
    panels: {
      model: r.panels.panel.model,
      wattsPeak: r.panels.panel.wattsPeak,
      count: r.panels.count,
      arrayKwp: (r.panels.count * r.panels.panel.wattsPeak) / 1000,
    },
  };
}
