import { and, count, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { HOUSE_AD_SECONDS, hasRoleAtLeast } from "../../shared/domain";
import { adEvents, ads, quotes } from "../db/schema";
import type { AppEnv, SessionUser } from "../lib/context";
import { ApiError, ok } from "../lib/http";
import { currentUser, requireAuth } from "../lib/middleware";
import { validate } from "../lib/validate";
import { loadPdfAssets } from "../pdf/assets";
import { renderQuotePdf } from "../pdf/quote-pdf";
import { createQuote, isUnlocked, preparedBy, quoteView, refreshQuote, type QuoteRow } from "../quotes/service";

/** Quote visibility (PRD §20.3): creator, assigned installer, or admin. */
function visibleTo(user: SessionUser): SQL | undefined {
  if (hasRoleAtLeast(user.role, "admin")) return undefined;
  return or(eq(quotes.userId, user.id), eq(quotes.installerId, user.id));
}

const idParam = z.object({ id: z.string().uuid() });

export function shareUrl(c: Context<AppEnv>, quote: QuoteRow) {
  return `${c.var.publicUrl}/q/${quote.shareToken}`;
}

export async function pdfResponse(c: Context<AppEnv>, quote: QuoteRow) {
  const view = quoteView(quote, { preparedBy: await preparedBy(c.var.db, quote) });
  const bytes = await renderQuotePdf(view, await loadPdfAssets(), { publicUrl: c.var.publicUrl });
  return c.body(bytes, 200, {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${quote.reference}.pdf"`,
    "cache-control": "private, no-store",
  });
}

async function loadVisible(c: Context<AppEnv>, id: string): Promise<QuoteRow> {
  const user = currentUser(c);
  const [quote] = await c.var.db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), visibleTo(user)))
    .limit(1);
  if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found.");
  return refreshQuote(c.var.db, quote);
}

/** Weighted random pick of an active ad; null means show the built-in house ad. */
async function pickAd(c: Context<AppEnv>) {
  const active = await c.var.db.select().from(ads).where(eq(ads.isActive, true));
  const total = active.reduce((s, a) => s + Math.max(a.weight, 0), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const ad of active) {
    roll -= Math.max(ad.weight, 0);
    if (roll < 0) return ad;
  }
  return active[active.length - 1]!;
}

export const quoteRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  /** Persist a calculation as a quote (PRD §22.2 generate-quote). */
  .post(
    "/",
    validate("json", z.object({ calculationId: z.string().uuid(), clientName: z.string().trim().max(80).optional() }).strict()),
    async (c) => {
      const quote = await createQuote(c.var.db, currentUser(c), c.req.valid("json"));
      return ok(c, quoteView(quote, { preparedBy: await preparedBy(c.var.db, quote), unlocked: await isUnlocked(c.var.db, quote, currentUser(c)) }), 201);
    },
  )

  .get(
    "/",
    validate(
      "query",
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      }),
    ),
    async (c) => {
      const user = currentUser(c);
      const { page, pageSize } = c.req.valid("query");
      const where = visibleTo(user);
      const [rows, [total]] = await Promise.all([
        c.var.db
          .select({
            id: quotes.id,
            reference: quotes.reference,
            clientName: quotes.clientName,
            state: quotes.state,
            // Expiry is time-based, so report it without waiting for a detail view to persist it.
            status: sql<string>`CASE WHEN ${quotes.expiresAt} <= now() THEN 'expired' ELSE ${quotes.status}::text END`,
            flags: quotes.flags,
            totalCostNgn: quotes.totalCostNgn,
            createdAt: quotes.createdAt,
            expiresAt: quotes.expiresAt,
          })
          .from(quotes)
          .where(where)
          .orderBy(desc(quotes.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        c.var.db.select({ value: count() }).from(quotes).where(where),
      ]);
      return ok(c, { items: rows, page, pageSize, total: total?.value ?? 0 });
    },
  )

  .get("/:id", validate("param", idParam), async (c) => {
    const user = currentUser(c);
    const quote = await loadVisible(c, c.req.valid("param").id);
    const unlocked = await isUnlocked(c.var.db, quote, user);
    return ok(
      c,
      quoteView(quote, {
        preparedBy: await preparedBy(c.var.db, quote),
        unlocked,
        // The share link is itself an ungated PDF, so it is only revealed once unlocked.
        shareUrl: unlocked && quote.status !== "expired" ? shareUrl(c, quote) : null,
      }),
    );
  })

  /** PDF download, ad-gated for free users (PRD §31). */
  .get("/:id/pdf", validate("param", idParam), async (c) => {
    const quote = await loadVisible(c, c.req.valid("param").id);
    if (quote.status === "expired") throw new ApiError(410, "QUOTE_EXPIRED", "This quote has expired. Please calculate your system again for current prices.");
    if (!(await isUnlocked(c.var.db, quote, currentUser(c)))) {
      throw new ApiError(403, "AD_REQUIRED", "Watch a short ad to unlock your quote download.");
    }
    return pdfResponse(c, quote);
  })

  /** Starts an ad view for this quote. Returns immediately if already unlocked. */
  .post("/:id/ad/start", validate("param", idParam), async (c) => {
    const user = currentUser(c);
    const quote = await loadVisible(c, c.req.valid("param").id);
    if (await isUnlocked(c.var.db, quote, user)) return ok(c, { unlocked: true as const });
    const ad = await pickAd(c);
    const [event] = await c.var.db
      .insert(adEvents)
      .values({ quoteId: quote.id, userId: user.id, adId: ad?.id ?? null })
      .returning({ id: adEvents.id });
    return ok(c, {
      unlocked: false as const,
      adEventId: event!.id,
      ad: { id: ad?.id ?? null, providerUrl: ad?.providerUrl ?? null, durationSeconds: ad?.durationSeconds ?? HOUSE_AD_SECONDS },
    });
  })

  /**
   * Completes an ad view. The server checks that at least the ad's duration has
   * elapsed since start, using database time (PRD §31.2).
   */
  .post(
    "/:id/ad/complete",
    validate("param", idParam),
    validate("json", z.object({ adEventId: z.string().uuid() }).strict()),
    async (c) => {
      const user = currentUser(c);
      const quote = await loadVisible(c, c.req.valid("param").id);
      const { adEventId } = c.req.valid("json");
      const [event] = await c.var.db
        .select({
          id: adEvents.id,
          elapsedSeconds: sql<number>`extract(epoch from now() - ${adEvents.startedAt})::float`,
          durationSeconds: sql<number>`coalesce(${ads.durationSeconds}, ${HOUSE_AD_SECONDS})`,
        })
        .from(adEvents)
        .leftJoin(ads, eq(ads.id, adEvents.adId))
        .where(and(eq(adEvents.id, adEventId), eq(adEvents.quoteId, quote.id), eq(adEvents.userId, user.id), isNull(adEvents.completedAt)))
        .limit(1);
      if (!event) throw new ApiError(404, "NOT_FOUND", "Ad session not found or already completed.", "adEventId");
      if (Number(event.elapsedSeconds) < Number(event.durationSeconds)) {
        throw new ApiError(400, "AD_INCOMPLETE", "Please watch the ad to the end to unlock your quote.");
      }
      await c.var.db.update(adEvents).set({ completedAt: sql`now()` }).where(eq(adEvents.id, event.id));
      return ok(c, { unlocked: true as const, shareUrl: quote.status !== "expired" ? shareUrl(c, quote) : null });
    },
  );
