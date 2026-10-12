import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl: string, { max = 10 }: { max?: number } = {}) {
  // prepare:false keeps queries compatible with transaction-mode poolers (Neon, PgBouncer).
  const sql = postgres(databaseUrl, { max, prepare: false, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type Db = ReturnType<typeof createDb>["db"];
