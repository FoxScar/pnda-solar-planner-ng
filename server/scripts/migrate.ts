import "dotenv/config";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, sql } = createDb(url);
await runMigrations(db);
console.log("Migrations applied.");
await sql.end();
