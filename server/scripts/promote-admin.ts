// Usage: npm run admin:promote -- someone@example.com
// The account must already exist (sign up in the app first).
import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDb } from "../db/client";
import { auditLog, user, userProfiles } from "../db/schema";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin:promote -- <email>");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, sql } = createDb(url);

const [target] = await db.select().from(user).where(eq(user.email, email)).limit(1);
if (!target) {
  console.error(`No account with email ${email}. Sign up in the app first.`);
  await sql.end();
  process.exit(1);
}

await db.transaction(async (tx) => {
  const [before] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, target.id));
  const [after] = await tx
    .insert(userProfiles)
    .values({ userId: target.id, role: "admin" })
    .onConflictDoUpdate({ target: userProfiles.userId, set: { role: "admin" } })
    .returning();
  await tx.insert(auditLog).values({
    actorId: "cli:promote-admin",
    action: "ROLE_CHANGE",
    entityType: "user",
    entityId: target.id,
    before: before ?? null,
    after,
  });
});
console.log(`${email} is now an admin.`);
await sql.end();
