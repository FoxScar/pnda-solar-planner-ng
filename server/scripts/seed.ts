import "dotenv/config";
import { createDb } from "../db/client";
import { seed } from "../db/seed/seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, sql } = createDb(url);
const counts = await seed(db);
console.log("Seed complete (existing rows left untouched):", counts);
await sql.end();
