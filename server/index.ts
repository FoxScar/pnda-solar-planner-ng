import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { createDb } from "./db/client";
import { loadEnv } from "./env";

const env = loadEnv();
const { db, sql } = createDb(env.DATABASE_URL);
const auth = createAuth({ db, secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
const app = createApp({ db, auth, publicUrl: env.PUBLIC_APP_URL ?? env.BETTER_AUTH_URL });

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`PandaSolution API listening on http://localhost:${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    server.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}
