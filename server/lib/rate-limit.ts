import { sql } from "drizzle-orm";
import type { Context } from "hono";
import type { Db } from "../db/client";
import type { AppEnv } from "./context";
import { ApiError } from "./http";

/**
 * Fixed-window limiter stored in Postgres, so it holds across API instances
 * and serverless isolates. One atomic upsert per request.
 */
export async function consumeRateLimit(db: Db, key: string, limit: number, windowSeconds: number) {
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count) VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds})
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds})
                   THEN now() ELSE rate_limits.window_start END
    RETURNING count
  `);
  const count = Number(rows[0]?.count ?? 0);
  if (count > limit) {
    throw new ApiError(429, "RATE_LIMITED", `Too many requests. Please wait a minute and try again.`);
  }
}

/**
 * Signed-in users are limited per account; guests per client IP.
 * cf-connecting-ip is set (and client values stripped) by Cloudflare in production.
 */
export function rateLimitKey(c: Context<AppEnv>, scope: string): string {
  if (c.var.user) return `${scope}:user:${c.var.user.id}`;
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return `${scope}:ip:${ip}`;
}
