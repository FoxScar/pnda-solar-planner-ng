import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import type { Auth } from "./auth";
import type { Db } from "./db/client";
import type { AppEnv } from "./lib/context";
import { ApiError, fail, ok } from "./lib/http";
import { loadSession } from "./lib/middleware";
import { EngineError } from "./engine";
import { adminRoutes } from "./routes/admin";
import { calculateRoutes } from "./routes/calculate";
import { catalogRoutes } from "./routes/catalog";
import { meRoutes } from "./routes/me";
import { publicRoutes } from "./routes/public";
import { quoteRoutes } from "./routes/quotes";

/** Maps Postgres constraint violations to client errors instead of 500s. */
function fromPostgresError(err: unknown): ApiError | null {
  const pgErr = (err as { cause?: unknown })?.cause ?? err;
  const code = (pgErr as { code?: string })?.code;
  const detail = (pgErr as { detail?: string; constraint_name?: string });
  if (code === "23505") {
    return new ApiError(409, "INVALID_PAYLOAD", "A record with these details already exists.", undefined, detail.detail);
  }
  if (code === "23514" || code === "23502" || code === "22P02") {
    return new ApiError(400, "INVALID_PAYLOAD", "The data breaks a validation rule.", undefined, detail.constraint_name);
  }
  return null;
}

export function createApp({ db, auth, publicUrl }: { db: Db; auth: Auth; publicUrl: string }) {
  const app = new Hono<AppEnv>();

  app.use(secureHeaders());
  app.use(requestId());
  app.use(async (c, next) => {
    c.set("db", db);
    c.set("auth", auth);
    c.set("publicUrl", publicUrl.replace(/\/$/, ""));
    await next();
  });

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  const v1 = new Hono<AppEnv>()
    .use(loadSession)
    .get("/health", async (c) => {
      await db.execute("select 1");
      return ok(c, { status: "ok" });
    })
    .route("/", catalogRoutes)
    .route("/", calculateRoutes)
    .route("/me", meRoutes)
    .route("/quotes", quoteRoutes)
    .route("/public", publicRoutes)
    .route("/admin", adminRoutes);

  app.route("/api/v1", v1);

  app.notFound((c) => fail(c, new ApiError(404, "NOT_FOUND", "Route not found.")));

  app.onError((err, c) => {
    if (err instanceof ApiError) return fail(c, err);
    if (err instanceof EngineError) {
      const status = err.code === "INVALID_PAYLOAD" ? 400 : 422;
      return fail(c, new ApiError(status, err.code, err.message, err.field, err.details));
    }
    const pg = fromPostgresError(err);
    if (pg) return fail(c, pg);
    console.error(`[${c.var.requestId}]`, err);
    return fail(c, new ApiError(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again."));
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
