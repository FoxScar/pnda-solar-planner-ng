import { eq, sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auditLog, components, userProfiles } from "../db/schema";
import { createHarness } from "./harness";

const h = createHarness();
afterAll(() => h.sql.end());

describe("platform", () => {
  it("health check returns the standard envelope", async () => {
    const res = await h.request("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: "ok" } });
    expect(res.body?.meta.requestId).toBeTruthy();
    expect(res.body?.meta.engineVersion).toBeTruthy();
  });

  it("unknown routes return NOT_FOUND in the error envelope", async () => {
    const res = await h.request("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: "NOT_FOUND", message: "Route not found." } });
  });
});

describe("public catalogue", () => {
  it("lists at least 60 active appliances without exposing wattage (FR-001, FR-003)", async () => {
    const res = await h.request("/api/v1/appliances");
    expect(res.status).toBe(200);
    const items = res.body?.data as Record<string, unknown>[];
    expect(items.length).toBeGreaterThanOrEqual(60);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["category", "id", "name"]);
    }
  });

  it("lists all 36 states plus FCT", async () => {
    const res = await h.request("/api/v1/sun-hours");
    const states = (res.body?.data as { state: string }[]).map((s) => s.state);
    expect(states).toHaveLength(37);
    expect(states).toContain("FCT");
    expect(states).toContain("Lagos");
  });

  it("seeds the Felicity catalogue with PRD voltages (≤4kVA → 24V, ≥5kVA → 48V)", async () => {
    const inverters = await h.db.select().from(components).where(eq(components.type, "inverter"));
    expect(inverters.map((i) => i.kva).sort((a, b) => a! - b!)).toEqual([1.8, 3, 4, 5, 6, 8, 12]);
    for (const inv of inverters) {
      expect(inv.dcVoltage).toBe(inv.kva! <= 4 ? 24 : 48);
    }
  });
});

describe("auth and roles", () => {
  it("rejects anonymous access to /me", async () => {
    const res = await h.request("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body?.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates a consumer profile on sign-up", async () => {
    const { cookie, email } = await h.signUp();
    const res = await h.request("/api/v1/me", { cookie });
    expect(res.status).toBe(200);
    expect(res.body?.data).toMatchObject({ email, role: "consumer", profile: { role: "consumer" } });
  });

  it("enforces the 8-character minimum password", async () => {
    const res = await h.request("/api/auth/sign-up/email", {
      method: "POST",
      json: { email: `short-${crypto.randomUUID()}@test.ng`, password: "short", name: "x" },
    });
    expect(res.status).toBe(400);
  });

  it("lets a user update their WhatsApp number but rejects junk", async () => {
    const { cookie } = await h.signUp();
    const good = await h.request("/api/v1/me/profile", { method: "PATCH", cookie, json: { whatsappNumber: "+2348012345678" } });
    expect(good.status).toBe(200);
    expect(good.body?.data.whatsappNumber).toBe("+2348012345678");

    const bad = await h.request("/api/v1/me/profile", { method: "PATCH", cookie, json: { whatsappNumber: "hello" } });
    expect(bad.status).toBe(400);
    expect(bad.body?.error).toMatchObject({ code: "INVALID_PAYLOAD", field: "whatsappNumber" });
  });

  it("users cannot raise their own role through the profile endpoint", async () => {
    const { cookie } = await h.signUp();
    const res = await h.request("/api/v1/me/profile", { method: "PATCH", cookie, json: { role: "admin" } });
    expect(res.status).toBe(400);
  });

  it("blocks consumers from admin and installer routes", async () => {
    const { cookie } = await h.signUp();
    expect((await h.request("/api/v1/admin/components", { cookie })).status).toBe(403);
    expect((await h.request("/api/v1/components", { cookie })).status).toBe(403);
  });

  it("allows installers to read inventory but not to administer it", async () => {
    const { cookie } = await h.signUp("installer");
    expect((await h.request("/api/v1/components", { cookie })).status).toBe(200);
    expect((await h.request("/api/v1/admin/components", { cookie })).status).toBe(403);
  });
});

describe("admin inventory management", () => {
  it("updates a price and writes a PRICE_UPDATE audit entry with before/after", async () => {
    const { cookie, userId } = await h.signUp("admin");
    const [panel] = await h.db.select().from(components).where(eq(components.sku, "PNL-MONO-400"));
    const res = await h.request(`/api/v1/admin/components/${panel!.id}`, {
      method: "PATCH",
      cookie,
      json: { unitPriceNgn: 125_000 },
    });
    expect(res.status).toBe(200);
    expect(res.body?.data.unitPriceNgn).toBe(125_000);

    const [entry] = await h.db.select().from(auditLog).where(eq(auditLog.entityId, panel!.id));
    expect(entry).toMatchObject({ actorId: userId, action: "PRICE_UPDATE", entityType: "component" });
    expect((entry!.before as { unitPriceNgn: number }).unitPriceNgn).toBe(panel!.unitPriceNgn);
    expect((entry!.after as { unitPriceNgn: number }).unitPriceNgn).toBe(125_000);
    expect(entry!.requestId).toBeTruthy();
  });

  it("rejects a ₦0 price", async () => {
    const { cookie } = await h.signUp("admin");
    const [panel] = await h.db.select().from(components).where(eq(components.sku, "PNL-MONO-400"));
    const res = await h.request(`/api/v1/admin/components/${panel!.id}`, { method: "PATCH", cookie, json: { unitPriceNgn: 0 } });
    expect(res.status).toBe(400);
    expect(res.body?.error.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects inverters above 12kVA and invalid DC voltages", async () => {
    const { cookie } = await h.signUp("admin");
    const base = { type: "inverter", brand: "Felicity", model: "Too big", unitPriceNgn: 1 };
    const tooBig = await h.request("/api/v1/admin/components", { method: "POST", cookie, json: { ...base, sku: "X-15K", kva: 15, dcVoltage: 48 } });
    expect(tooBig.status).toBe(400);
    const badVoltage = await h.request("/api/v1/admin/components", { method: "POST", cookie, json: { ...base, sku: "X-36V", kva: 3, dcVoltage: 36 } });
    expect(badVoltage.status).toBe(400);
  });

  it("enforces type-specific fields at the database level too", async () => {
    await expect(
      h.db.insert(components).values({ sku: "RAW-BAD", type: "battery", brand: "x", model: "x", unitPriceNgn: 1, dcVoltage: 48 }),
    ).rejects.toThrow();
  });

  it("returns 409 for a duplicate SKU", async () => {
    const { cookie } = await h.signUp("admin");
    const res = await h.request("/api/v1/admin/components", {
      method: "POST",
      cookie,
      json: { type: "panel", sku: "PNL-MONO-400", brand: "x", model: "x", unitPriceNgn: 1, wattsPeak: 400 },
    });
    expect(res.status).toBe(409);
  });

  it("validates sun-hour ordering (wet ≤ annual ≤ dry)", async () => {
    const { cookie } = await h.signUp("admin");
    // Osun is not used by other tests; restored below so test files stay independent.
    const bad = await h.request("/api/v1/admin/sun-hours/Osun", { method: "PATCH", cookie, json: { annualAvg: 4.7, wetSeason: 5.5, drySeason: 5.0 } });
    expect(bad.status).toBe(400);
    const good = await h.request("/api/v1/admin/sun-hours/Osun", { method: "PATCH", cookie, json: { annualAvg: 4.8, wetSeason: 4.1, drySeason: 5.1 } });
    expect(good.status).toBe(200);
    await h.request("/api/v1/admin/sun-hours/Osun", { method: "PATCH", cookie, json: { annualAvg: 4.7, wetSeason: 4.0, drySeason: 5.0 } });
    const missing = await h.request("/api/v1/admin/sun-hours/Atlantis", { method: "PATCH", cookie, json: { annualAvg: 4.8, wetSeason: 4.1, drySeason: 5.1 } });
    expect(missing.body?.error.code).toBe("STATE_NOT_FOUND");
  });

  it("changes another user's role with an audit entry, but never the admin's own", async () => {
    const admin = await h.signUp("admin");
    const target = await h.signUp();
    const own = await h.request(`/api/v1/admin/users/${admin.userId}/role`, { method: "PATCH", cookie: admin.cookie, json: { role: "consumer" } });
    expect(own.status).toBe(403);

    const res = await h.request(`/api/v1/admin/users/${target.userId}/role`, { method: "PATCH", cookie: admin.cookie, json: { role: "installer" } });
    expect(res.status).toBe(200);
    const [profile] = await h.db.select().from(userProfiles).where(eq(userProfiles.userId, target.userId));
    expect(profile?.role).toBe("installer");
    const [entry] = await h.db.select().from(auditLog).where(eq(auditLog.entityId, target.userId));
    expect(entry?.action).toBe("ROLE_CHANGE");
  });
});

describe("write-once audit tables", () => {
  it("rejects UPDATE, DELETE and TRUNCATE on audit_log", async () => {
    await h.db.insert(auditLog).values({ actorId: "t", action: "PRICE_UPDATE", entityType: "component", entityId: "t" });
    await expect(h.db.update(auditLog).set({ actorId: "tampered" })).rejects.toThrow();
    await expect(h.db.delete(auditLog)).rejects.toThrow();
    await expect(h.db.execute(dsql`TRUNCATE audit_log`)).rejects.toThrow();
  });
});
