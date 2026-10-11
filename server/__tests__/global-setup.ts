import "dotenv/config";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { seed } from "../db/seed/seed";

/** Rebuilds the test database from scratch once per test run. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  if (!/test/.test(new URL(url).pathname)) {
    throw new Error(`Refusing to reset a database whose name does not contain "test": ${url}`);
  }
  const { db, sql } = createDb(url);
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  await runMigrations(db);
  await seed(db);
  await sql.end();
}
