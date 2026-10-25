import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { hasRoleAtLeast, type Role } from "../../shared/domain";
import { userProfiles } from "../db/schema";
import type { AppEnv, SessionUser } from "./context";
import { ApiError } from "./http";

/** Resolves the Better Auth session (if any) and the user's role. Never rejects. */
export const loadSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  let user: SessionUser | null = null;
  if (session) {
    const [profile] = await c.var.db
      .select({ role: userProfiles.role, status: userProfiles.status })
      .from(userProfiles)
      .where(eq(userProfiles.userId, session.user.id))
      .limit(1);
    user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: profile?.role ?? "consumer",
      status: profile?.status ?? "active",
    };
  }
  c.set("user", user);
  await next();
});

export function requireRole(minimum: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.var.user;
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
    if (user.status !== "active") throw new ApiError(403, "FORBIDDEN", "This account is suspended.");
    if (!hasRoleAtLeast(user.role, minimum)) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission to do this.");
    }
    await next();
  });
}

export const requireAuth = requireRole("consumer");

/** Returns the signed-in user; only call after requireRole/requireAuth. */
export function currentUser(c: { var: AppEnv["Variables"] }): SessionUser {
  const user = c.var.user;
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}
