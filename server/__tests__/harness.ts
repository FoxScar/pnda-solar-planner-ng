import "dotenv/config";
import { eq } from "drizzle-orm";
import { createApp } from "../app";
import { createAuth } from "../auth";
import { createDb } from "../db/client";
import { userProfiles } from "../db/schema";
import type { Role } from "../../shared/domain";

const ORIGIN = "http://localhost:8080";

export function createHarness() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  const { db, sql } = createDb(url);
  const auth = createAuth({ db, secret: "test-secret-that-is-at-least-32-characters-long", baseURL: ORIGIN });
  const app = createApp({ db, auth, publicUrl: "https://pandasolution.test" });

  async function request(path: string, init: RequestInit & { cookie?: string; json?: unknown } = {}) {
    const headers = new Headers(init.headers);
    headers.set("origin", ORIGIN);
    if (init.cookie) headers.set("cookie", init.cookie);
    let body = init.body;
    if (init.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(init.json);
    }
    const res = await app.request(`http://localhost${path}`, { ...init, headers, body });
    const text = await res.text();
    // Tests assert on arbitrary response shapes, so the parsed body is intentionally untyped.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = text ? (JSON.parse(text) as Record<string, any>) : null;
    return { status: res.status, body: parsed, headers: res.headers };
  }

  /** Signs up a fresh user, optionally sets their role, returns the session cookie. */
  async function signUp(role: Role = "consumer", email = `user-${crypto.randomUUID()}@test.ng`) {
    const res = await request("/api/auth/sign-up/email", {
      method: "POST",
      json: { email, password: "correct-horse-battery", name: "Test User" },
    });
    if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const userId = res.body?.user?.id as string;
    if (role !== "consumer") {
      await db.update(userProfiles).set({ role }).where(eq(userProfiles.userId, userId));
    }
    return { cookie, userId, email };
  }

  return { app, db, sql, request, signUp };
}
