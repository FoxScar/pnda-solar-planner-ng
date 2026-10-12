import { eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { quotes } from "../db/schema";
import type { AppEnv } from "../lib/context";
import { ApiError, ok } from "../lib/http";
import { validate } from "../lib/validate";
import { preparedBy, quoteView, refreshQuote, type QuoteRow } from "../quotes/service";
import { pdfResponse } from "./quotes";

const tokenParam = z.object({ token: z.string().min(20).max(64) });

/**
 * Loads a quote by its share token. Links stay public for the 30-day validity
 * period (PRD §29.2); a view by anyone other than the owner marks it "viewed".
 */
async function loadShared(c: Context<AppEnv>, token: string): Promise<QuoteRow> {
  const [quote] = await c.var.db.select().from(quotes).where(eq(quotes.shareToken, token)).limit(1);
  if (!quote) throw new ApiError(404, "NOT_FOUND", "This quote link is not valid.");
  const viewer = c.var.user?.id;
  const isOwner = viewer !== undefined && (viewer === quote.userId || viewer === quote.installerId);
  const refreshed = await refreshQuote(c.var.db, quote, { markViewed: !isOwner });
  if (refreshed.status === "expired") {
    throw new ApiError(410, "QUOTE_EXPIRED", "This quote has expired. Ask for an updated quote.");
  }
  return refreshed;
}

export const publicRoutes = new Hono<AppEnv>()
  .get("/quotes/:token", validate("param", tokenParam), async (c) => {
    const quote = await loadShared(c, c.req.valid("param").token);
    return ok(c, quoteView(quote, { preparedBy: await preparedBy(c.var.db, quote) }));
  })
  .get("/quotes/:token/pdf", validate("param", tokenParam), async (c) => {
    const quote = await loadShared(c, c.req.valid("param").token);
    return pdfResponse(c, quote);
  });
