import { desc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { appliances, auditLog, components, quoteCalcAudit, rateLimits, sunHours } from "../db/schema";
import { createHarness } from "./harness";

const h = createHarness();
afterAll(() => h.sql.end());

async function applianceId(name: string) {
  const [row] = await h.db.select({ id: appliances.id }).from(appliances).where(eq(appliances.name, name));
  if (!row) throw new Error(`missing appliance ${name}`);
  return row.id;
}

/** Each call gets its own fake client IP so guest rate limits don't interfere between tests. */
function guest() {
  return { "x-forwarded-for": `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` };
}

async function ref001Body() {
  return {
    state: "Lagos",
    batteryChemistry: "lithium",
    appliances: [
      { applianceId: await applianceId("Ceiling Fan"), quantity: 3, dayHours: 8, nightHours: 8 },
      { applianceId: await applianceId('TV (43" LED)'), quantity: 1, dayHours: 4, nightHours: 4 },
      { applianceId: await applianceId("LED Bulb (9W)"), quantity: 5, dayHours: 0, nightHours: 6 },
      { applianceId: await applianceId("Refrigerator (Single Door)"), quantity: 1, dayHours: 11, nightHours: 13 },
    ],
  };
}

describe("POST /api/v1/calculate", () => {
  it("returns the REF-001 system for a guest, without load figures (FR-003)", async () => {
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: await ref001Body() });
    expect(res.status).toBe(200);
    const data = res.body?.data;
    expect(data.system).toMatchObject({
      systemVoltage: 24,
      inverter: { kva: 1.8 },
      battery: { units: 2, installedKwh: 10 },
      panels: { count: 8, wattsPeak: 400 },
    });
    expect(data.bom.map((l: { sku: string }) => l.sku)).toEqual(["INV-FEL-1K8-24", "BAT-LI-24-5K", "PNL-MONO-400"]);
    expect(data.pricing.totalNgn).toBe(data.pricing.equipmentSubtotalNgn + data.pricing.vatNgn);
    expect(data.calculation).toBeUndefined();
    expect(JSON.stringify(data)).not.toMatch(/watts"|EnergyKwh|PeakKw/);
  });

  it("writes an immutable audit row with inputs and results", async () => {
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: await ref001Body() });
    const [row] = await h.db.select().from(quoteCalcAudit).where(eq(quoteCalcAudit.id, res.body?.data.calculationId));
    expect(row?.userId).toBeNull();
    expect((row?.inputs as { sunHours: { wetSeason: number } }).sunHours.wetSeason).toBe(4.0);
    expect((row?.stepResults as { battery: { totalUnits: number } }).battery.totalUnits).toBe(2);
  });

  it("gives engineers the full calculation sheet (US-009)", async () => {
    const { cookie } = await h.signUp("engineer");
    const res = await h.request("/api/v1/calculate", { method: "POST", cookie, json: await ref001Body() });
    expect(res.body?.data.calculation.load.nightEnergyKwh).toBeCloseTo(4.34, 6);
  });

  it("rejects lead-acid with AC as CHEMISTRY_RESTRICTED and still audits it", async () => {
    const body = {
      state: "FCT",
      batteryChemistry: "tubular",
      appliances: [{ applianceId: await applianceId("Air Conditioner (1HP)"), quantity: 1, dayHours: 0, nightHours: 6 }],
    };
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: body });
    expect(res.status).toBe(422);
    expect(res.body?.error).toMatchObject({ code: "CHEMISTRY_RESTRICTED", field: "batteryChemistry" });
    const [last] = await h.db.select().from(quoteCalcAudit).orderBy(desc(quoteCalcAudit.createdAt)).limit(1);
    expect((last?.stepResults as { error: { code: string } }).error.code).toBe("CHEMISTRY_RESTRICTED");
  });

  it("only lets engineers override, and logs the override", async () => {
    const body = {
      state: "FCT",
      batteryChemistry: "gel",
      engineerOverride: true,
      appliances: [{ applianceId: await applianceId("Air Conditioner (1HP)"), quantity: 1, dayHours: 0, nightHours: 6 }],
    };
    const consumer = await h.signUp();
    expect((await h.request("/api/v1/calculate", { method: "POST", cookie: consumer.cookie, json: body })).status).toBe(403);

    const engineer = await h.signUp("engineer");
    const res = await h.request("/api/v1/calculate", { method: "POST", cookie: engineer.cookie, json: body });
    expect(res.status).toBe(200);
    expect(res.body?.data.system.batteryChemistry).toBe("gel");
    const [entry] = await h.db.select().from(auditLog).where(eq(auditLog.entityId, res.body?.data.calculationId));
    expect(entry).toMatchObject({ action: "ENGINEER_OVERRIDE", actorId: engineer.userId });
  });

  it("returns OVERSIZE_REQUIRED above 12kVA", async () => {
    const body = {
      state: "Kano",
      appliances: [{ applianceId: await applianceId("Air Conditioner (2HP)"), quantity: 4, dayHours: 0, nightHours: 8 }],
    };
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: body });
    expect(res.status).toBe(422);
    expect(res.body?.error.code).toBe("OVERSIZE_REQUIRED");
  });

  it("accepts custom appliances and flags implausible wattage", async () => {
    const body = { state: "Oyo", appliances: [{ custom: { name: "Welding machine", watts: 6000 }, quantity: 1, dayHours: 1, nightHours: 0 }] };
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: body });
    expect(res.status).toBe(200);
    expect(res.body?.data.warnings.map((w: { code: string }) => w.code)).toContain("CUSTOM_WATTAGE_HIGH");
  });

  it("validates input: unknown state, zero hours, >24 hours, zero wattage, inactive appliance", async () => {
    const id = await applianceId("Ceiling Fan");
    const line = { applianceId: id, quantity: 1, dayHours: 2, nightHours: 2 };
    const cases = [
      { state: "Atlantis", appliances: [line] },
      { state: "Lagos", appliances: [{ ...line, dayHours: 0, nightHours: 0 }] },
      { state: "Lagos", appliances: [{ ...line, dayHours: 12, nightHours: 13 }] },
      { state: "Lagos", appliances: [{ custom: { name: "x", watts: 0 }, quantity: 1, dayHours: 1, nightHours: 0 }] },
      { state: "Lagos", appliances: [] },
    ];
    for (const body of cases) {
      const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: body });
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body?.error.code).toBe("INVALID_PAYLOAD");
    }

    await h.db.update(appliances).set({ isActive: false }).where(eq(appliances.name, "Table Fan"));
    const hidden = await applianceId("Table Fan");
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: { state: "Lagos", appliances: [{ ...line, applianceId: hidden }] } });
    expect(res.status).toBe(400);
    expect(res.body?.error.field).toBe("appliances.0.applianceId");
  });

  it("uses the admin's latest price and excludes out-of-stock components", async () => {
    await h.db.update(components).set({ unitPriceNgn: 999_999 }).where(eq(components.sku, "BAT-LI-24-5K"));
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: await ref001Body() });
    expect(res.body?.data.bom[1].unitPriceNgn).toBe(999_999);

    await h.db.update(components).set({ isActive: false }).where(eq(components.sku, "BAT-LI-24-5K"));
    const out = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: await ref001Body() });
    expect(out.status).toBe(422);
    expect(out.body?.error.code).toBe("NO_SKU_AVAILABLE");
    await h.db.update(components).set({ isActive: true, unitPriceNgn: 850_000 }).where(eq(components.sku, "BAT-LI-24-5K"));
  });

  it("falls back to 4.5 sun hours when a state's record is missing", async () => {
    const [ekiti] = await h.db.delete(sunHours).where(eq(sunHours.state, "Ekiti")).returning();
    const body = { ...(await ref001Body()), state: "Ekiti" };
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: body });
    expect(res.status).toBe(200);
    expect(res.body?.data.warnings.map((w: { code: string }) => w.code)).toContain("SUN_HOURS_FALLBACK");
    await h.db.insert(sunHours).values(ekiti!);
  });

  it("rate-limits to 10 calculations per minute per client", async () => {
    const headers = guest();
    const body = await ref001Body();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await h.request("/api/v1/calculate", { method: "POST", headers, json: body })).status);
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);

    // The window resets after a minute.
    await h.db.update(rateLimits).set({ windowStart: new Date(Date.now() - 61_000) });
    expect((await h.request("/api/v1/calculate", { method: "POST", headers, json: body })).status).toBe(200);
  });
});

describe("POST /api/v1/validate-config", () => {
  async function ids(...skus: string[]) {
    const rows = await h.db.select({ id: components.id, sku: components.sku }).from(components);
    return skus.map((s) => rows.find((r) => r.sku === s)!.id);
  }

  it("accepts a compatible combination and rejects a voltage mismatch", async () => {
    const { cookie } = await h.signUp();
    const [inv24, li24, li48, tub] = await ids("INV-FEL-3K-24", "BAT-LI-24-5K", "BAT-LI-48-10K", "BAT-TUB-12-220");

    const okRes = await h.request("/api/v1/validate-config", { method: "POST", cookie, json: { inverterId: inv24, batteries: [{ componentId: li24, seriesCount: 1 }] } });
    expect(okRes.body).toMatchObject({ success: true, data: { valid: true } });

    const bad = await h.request("/api/v1/validate-config", { method: "POST", cookie, json: { inverterId: inv24, batteries: [{ componentId: li48, seriesCount: 1 }] } });
    expect(bad.status).toBe(422);
    expect(bad.body?.error.code).toBe("VOLTAGE_MISMATCH");

    const mixed = await h.request("/api/v1/validate-config", {
      method: "POST",
      cookie,
      json: { inverterId: inv24, batteries: [{ componentId: li24, seriesCount: 1 }, { componentId: tub, seriesCount: 2 }] },
    });
    expect(mixed.body?.error.code).toBe("CHEMISTRY_MIXED");

    const wrongType = await h.request("/api/v1/validate-config", { method: "POST", cookie, json: { inverterId: li24, batteries: [{ componentId: li24, seriesCount: 1 }] } });
    expect(wrongType.status).toBe(400);
  });
});
