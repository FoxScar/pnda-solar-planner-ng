import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  BATTERY_CHEMISTRIES,
  hasRoleAtLeast,
  NATIONAL_DEFAULT_SUN_HOURS,
  NIGERIAN_STATES,
} from "../../shared/domain";
import type { Db } from "../db/client";
import { periodWindows } from "../../shared/settings";
import { appliances, auditLog, components, quoteCalcAudit, sunHours } from "../db/schema";
import { CUSTOM_APPLIANCE_OUTLIER_WATTS } from "../engine/constants";
import {
  assertCompatible,
  calculateSystem,
  ENGINE_VERSION,
  EngineError,
  priceBom,
  type EngineResult,
  type EngineWarning,
  type LoadItem,
  type SunHoursInput,
} from "../engine";
import { loadCatalogue, toBattery, toInverter } from "../lib/catalogue";
import type { AppEnv } from "../lib/context";
import { ApiError, ok } from "../lib/http";
import { requireAuth } from "../lib/middleware";
import { consumeRateLimit, rateLimitKey } from "../lib/rate-limit";
import { loadSettings } from "../lib/settings";
import { validate } from "../lib/validate";
import { systemView } from "../quotes/service";

/** PRD §20.3: 10 calculation requests per user per minute. */
const CALC_LIMIT_PER_MINUTE = 10;

const usage = {
  quantity: z.number().int().min(1).max(100),
  dayHours: z.number().min(0).max(24),
  nightHours: z.number().min(0).max(24),
};

const applianceLine = z
  .union([
    z.object({ applianceId: z.string().uuid(), ...usage }).strict(),
    z
      .object({
        custom: z.object({
          name: z.string().trim().min(1).max(60),
          watts: z.number().int().positive("Wattage must be greater than 0.").max(20_000),
        }),
        ...usage,
      })
      .strict(),
  ])
  .refine((l) => l.dayHours + l.nightHours > 0, { message: "Enter at least some daily use.", path: ["dayHours"] })
  .refine((l) => l.dayHours + l.nightHours <= 24, { message: "Day and night hours cannot exceed 24.", path: ["nightHours"] });

export const calculateBody = z
  .object({
    state: z.enum(NIGERIAN_STATES),
    batteryChemistry: z.enum(BATTERY_CHEMISTRIES).default("lithium"),
    engineerOverride: z.boolean().default(false),
    appliances: z.array(applianceLine).min(1, "Add at least one appliance.").max(60),
  })
  .strict();

type CalculateBody = z.infer<typeof calculateBody>;

async function resolveLoads(db: Db, lines: CalculateBody["appliances"]) {
  const ids = lines.flatMap((l) => ("applianceId" in l ? [l.applianceId] : []));
  const rows = ids.length
    ? await db.select().from(appliances).where(and(inArray(appliances.id, ids), eq(appliances.isActive, true)))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const warnings: EngineWarning[] = [];

  const loads: LoadItem[] = lines.map((line, i) => {
    const usageFields = { quantity: line.quantity, dayHours: line.dayHours, nightHours: line.nightHours };
    if ("custom" in line) {
      if (line.custom.watts > CUSTOM_APPLIANCE_OUTLIER_WATTS) {
        warnings.push({
          code: "CUSTOM_WATTAGE_HIGH",
          message: `"${line.custom.name}" is entered as ${line.custom.watts}W — please double-check this wattage.`,
        });
      }
      // Custom appliances have unknown motor behaviour; treated as non-surge loads.
      return { name: line.custom.name, watts: line.custom.watts, surgeFactor: 1, isAirConditioner: false, ...usageFields };
    }
    const row = byId.get(line.applianceId);
    if (!row) {
      throw new ApiError(400, "INVALID_PAYLOAD", "One of the selected appliances is no longer available.", `appliances.${i}.applianceId`);
    }
    return { name: row.name, watts: row.watts, surgeFactor: row.surgeFactor, isAirConditioner: row.isAirConditioner, ...usageFields };
  });
  return { loads, warnings };
}

async function resolveSunHours(db: Db, state: string): Promise<SunHoursInput> {
  const [row] = await db.select().from(sunHours).where(eq(sunHours.state, state)).limit(1);
  if (row) return { wetSeason: row.wetSeason, drySeason: row.drySeason, annualAvg: row.annualAvg, isFallback: false };
  // PRD §36: fall back to the national default and alert an admin.
  console.warn(`[sun-hours] No record for "${state}"; national default applied. Add it in the admin panel.`);
  const h = NATIONAL_DEFAULT_SUN_HOURS;
  return { wetSeason: h, drySeason: h, annualAvg: h, isFallback: true };
}

export const calculateRoutes = new Hono<AppEnv>()
  /**
   * Main solar decision engine endpoint (PRD §22.2). Guests may calculate
   * (soft auth, PRD §25.2); every call is rate-limited and audited.
   */
  .post("/calculate", validate("json", calculateBody), async (c) => {
    const body = c.req.valid("json");
    const user = c.var.user;
    const db = c.var.db;

    if (body.engineerOverride && !(user && hasRoleAtLeast(user.role, "engineer"))) {
      throw new ApiError(403, "FORBIDDEN", "Only engineers can override recommendations.", "engineerOverride");
    }
    await consumeRateLimit(db, rateLimitKey(c, "calculate"), CALC_LIMIT_PER_MINUTE, 60);

    const settings = await loadSettings(db);
    // Schematics §1: runtime is the hours actually used inside each period, so it can't exceed the window.
    const windows = periodWindows(settings.engine);
    body.appliances.forEach((line, i) => {
      if (line.dayHours > windows.dayHours) {
        throw new ApiError(400, "INVALID_PAYLOAD", `Daytime use can be at most ${windows.dayHours} hours (${settings.engine.nightEnd}–${settings.engine.nightStart}).`, `appliances.${i}.dayHours`);
      }
      if (line.nightHours > windows.nightHours) {
        throw new ApiError(400, "INVALID_PAYLOAD", `Night-time use can be at most ${windows.nightHours} hours (${settings.engine.nightStart}–${settings.engine.nightEnd}).`, `appliances.${i}.nightHours`);
      }
    });

    const [{ loads, warnings: inputWarnings }, sun, catalogue] = await Promise.all([
      resolveLoads(db, body.appliances),
      resolveSunHours(db, body.state),
      loadCatalogue(db),
    ]);
    const auditInputs = { request: body, loads, sunHours: sun, settings };

    let result: EngineResult;
    try {
      result = calculateSystem({
        loads,
        sunHours: sun,
        batteryChemistry: body.batteryChemistry,
        engineerOverride: body.engineerOverride,
        catalogue,
        settings: settings.engine,
      });
    } catch (err) {
      if (err instanceof EngineError) {
        await db.insert(quoteCalcAudit).values({
          userId: user?.id ?? null,
          inputs: auditInputs,
          stepResults: { error: { code: err.code, message: err.message, details: err.details ?? null } },
          engineVersion: ENGINE_VERSION,
        });
      }
      throw err;
    }

    const warnings = [...inputWarnings, ...result.warnings];
    const [audit] = await db
      .insert(quoteCalcAudit)
      .values({ userId: user?.id ?? null, inputs: auditInputs, stepResults: result, engineVersion: ENGINE_VERSION })
      .returning({ id: quoteCalcAudit.id });

    if (result.warnings.some((w) => w.code === "ENGINEER_OVERRIDE_LEAD_ACID_AC") && user) {
      await db.insert(auditLog).values({
        actorId: user.id,
        action: "ENGINEER_OVERRIDE",
        entityType: "calculation",
        entityId: audit!.id,
        before: { batteryChemistry: "lithium" },
        after: { batteryChemistry: body.batteryChemistry },
        requestId: c.var.requestId,
      });
    }

    const isEngineer = !!user && hasRoleAtLeast(user.role, "engineer");
    return ok(c, {
      calculationId: audit!.id,
      state: body.state,
      system: systemView(result),
      bom: result.bom,
      pricing: priceBom(result.bom, settings.pricing),
      quoteEligible: result.validation.quoteEligible,
      warnings,
      // Full calculation sheet for engineers and admins only (US-009).
      ...(isEngineer ? { calculation: result } : {}),
    });
  })

  /** Pre-checks a hand-picked inverter/battery combination (PRD §22.2 validate-config). */
  .post(
    "/validate-config",
    requireAuth,
    validate(
      "json",
      z
        .object({
          inverterId: z.string().uuid(),
          batteries: z
            .array(z.object({ componentId: z.string().uuid(), seriesCount: z.number().int().min(1).max(4) }).strict())
            .min(1),
        })
        .strict(),
    ),
    async (c) => {
      const { inverterId, batteries } = c.req.valid("json");
      const ids = [inverterId, ...batteries.map((b) => b.componentId)];
      const rows = await c.var.db.select().from(components).where(inArray(components.id, ids));
      const byId = new Map(rows.map((r) => [r.id, r]));
      const inverterRow = byId.get(inverterId);
      if (inverterRow?.type !== "inverter") throw new ApiError(400, "INVALID_PAYLOAD", "Choose a valid inverter.", "inverterId");
      const bank = batteries.map((b, i) => {
        const row = byId.get(b.componentId);
        if (row?.type !== "battery") throw new ApiError(400, "INVALID_PAYLOAD", "Choose valid batteries.", `batteries.${i}.componentId`);
        return { battery: toBattery(row), seriesCount: b.seriesCount };
      });
      assertCompatible(toInverter(inverterRow), bank);
      return ok(c, { valid: true });
    },
  );
