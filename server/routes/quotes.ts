import { and, count, desc, eq, or, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { hasRoleAtLeast } from "../../shared/domain";
import { quotes } from "../db/schema";
import type { AppEnv, SessionUser } from "../lib/context";
import { ApiError, ok } from "../lib/http";
import { currentUser, requireAuth } from "../lib/middleware";
import { validate } from "../lib/validate";

/** Quote visibility (PRD §20.3): creator, assigned installer, or admin. */
function visibleTo(user: SessionUser): SQL | undefined {
  if (hasRoleAtLeast(user.role, "admin")) return undefined;
  return or(eq(quotes.userId, user.id), eq(quotes.installerId, user.id));
}

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const quoteRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/", validate("query", listQuery), async (c) => {
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
          status: quotes.status,
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
  })
  .get("/:id", validate("param", z.object({ id: z.string().uuid() })), async (c) => {
    const user = currentUser(c);
    const { id } = c.req.valid("param");
    const [quote] = await c.var.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, id), visibleTo(user)))
      .limit(1);
    if (!quote) throw new ApiError(404, "NOT_FOUND", "Quote not found.");
    return ok(c, quote);
  });
