import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { createDb } from "./db/client";
import { loadEnv } from "./env";

const env = loadEnv();
const { db, sql } = createDb(env.DATABASE_URL);
const auth = createAuth({ db, secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
const app = createApp({ db, auth, publicUrl: env.PUBLIC_APP_URL ?? env.BETTER_AUTH_URL });

if (env.STATIC_DIR) {
  const root = path.resolve(env.STATIC_DIR);
  const indexHtml = await readFile(path.join(root, "index.html"), "utf8");
  // Vite fingerprints files under /assets, so they can be cached forever.
  app.use(
    "/assets/*",
    serveStatic({
      root,
      onFound: (_path, c) => c.header("cache-control", "public, max-age=31536000, immutable"),
    }),
  );
  app.use("*", serveStatic({ root }));
  // SPA fallback for client-side routes; unknown /api paths still get the JSON 404.
  app.get("*", (c, next) => (c.req.path.startsWith("/api/") ? next() : c.html(indexHtml)));
}

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`PandaSolution listening on port ${info.port}${env.STATIC_DIR ? " (serving frontend)" : ""}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    server.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}
