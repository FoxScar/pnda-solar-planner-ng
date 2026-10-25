import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { userProfiles } from "../db/schema";
import type { AppEnv } from "../lib/context";
import { ok } from "../lib/http";
import { currentUser, requireAuth } from "../lib/middleware";
import { validate } from "../lib/validate";

const profilePatch = z
  .object({
    whatsappNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number").nullable(),
    phone: z.string().max(32).nullable(),
    companyName: z.string().max(120).nullable(),
  })
  .partial()
  .strict();

export const meRoutes = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    const user = currentUser(c);
    const [profile] = await c.var.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);
    return ok(c, { ...user, profile: profile ?? null });
  })
  .patch("/profile", validate("json", profilePatch), async (c) => {
    const user = currentUser(c);
    const patch = c.req.valid("json");
    const [profile] = await c.var.db
      .insert(userProfiles)
      .values({ userId: user.id, ...patch })
      .onConflictDoUpdate({ target: userProfiles.userId, set: patch })
      .returning();
    return ok(c, profile);
  });
