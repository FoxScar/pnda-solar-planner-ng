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
      panels: { count: 11, wattsPeak: 400 },
    });
    expect(data.bom.map((l: { sku: string }) => l.sku)).toEqual(["INV-FEL-1K8-24", "BAT-LI-24-5K", "PNL-MONO-400"]);
    expect(data.pricing.installationFeeNgn).toBe(Math.round(data.pricing.equipmentSubtotalNgn * 0.15));
    expect(data.pricing.totalNgn).toBe(data.pricing.equipmentSubtotalNgn + data.pricing.installationFeeNgn + data.pricing.vatNgn);
    expect(data.quoteEligible).toBe(true);
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
      appliances: [{ applianceId: await applianceId("Air Conditioner (2HP)"), quantity: 6, dayHours: 0, nightHours: 8 }],
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

    // Without a 24V battery the smallest valid system moves to a 48V inverter (schematics §2).
    await h.db.update(components).set({ isActive: false }).where(eq(components.sku, "BAT-LI-24-5K"));
    const moved = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: await ref001Body() });
    expect(moved.status).toBe(200);
    expect(moved.body?.data.system.systemVoltage).toBe(48);
    expect(moved.body?.data.bom.map((l: { sku: string }) => l.sku)).not.toContain("BAT-LI-24-5K");
    await h.db.update(components).set({ isActive: true, unitPriceNgn: 850_000 }).where(eq(components.sku, "BAT-LI-24-5K"));

    // With no panels in stock there is no valid system at all.
    await h.db.update(components).set({ isActive: false }).where(eq(components.type, "panel"));
    const out = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: await ref001Body() });
    expect(out.status).toBe(422);
    expect(out.body?.error.code).toBe("NO_SKU_AVAILABLE");
    await h.db.update(components).set({ isActive: true }).where(eq(components.type, "panel"));
  });

  it("falls back to 4.5 sun hours when a state's record is missing", async () => {
    const [ekiti] = await h.db.delete(sunHours).where(eq(sunHours.state, "Ekiti")).returning();
    const body = { ...(await ref001Body()), state: "Ekiti" };
    const res = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: body });
    expect(res.status).toBe(200);
    expect(res.body?.data.warnings.map((w: { code: string }) => w.code)).toContain("SUN_HOURS_FALLBACK");
    await h.db.insert(sunHours).values(ekiti!);
  });

  it("limits runtime to the configured day (11h) and night (13h) windows", async () => {
    const id = await applianceId("Ceiling Fan");
    const config = await h.request("/api/v1/config");
    expect(config.body?.data).toEqual({ nightStart: "17:00", nightEnd: "06:00", nightHours: 13, dayHours: 11 });
    const day = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: { state: "Lagos", appliances: [{ applianceId: id, quantity: 1, dayHours: 12, nightHours: 0 }] } });
    expect(day.status).toBe(400);
    expect(day.body?.error.field).toBe("appliances.0.dayHours");
    const night = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: { state: "Lagos", appliances: [{ applianceId: id, quantity: 1, dayHours: 0, nightHours: 13.5 }] } });
    expect(night.body?.error.field).toBe("appliances.0.nightHours");
    const ok = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: { state: "Lagos", appliances: [{ applianceId: id, quantity: 1, dayHours: 11, nightHours: 13 }] } });
    expect(ok.status).toBe(200);
  });

  it("uses admin-configured settings and records them with the calculation", async () => {
    const admin = await h.signUp("admin");
    const before = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: await ref001Body() });
    const patch = await h.request("/api/v1/admin/settings", { method: "PATCH", cookie: admin.cookie, json: { engine: { safetyMargin: 1.0 }, pricing: { installationRate: 0 } } });
    expect(patch.status).toBe(200);
    try {
      const after = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: await ref001Body() });
      // 4.34 × 2.0 ÷ 0.684 = 12.69 kWh → 3 × 5 kWh instead of 2
      expect(before.body?.data.system.battery.units).toBe(2);
      expect(after.body?.data.system.battery.units).toBe(3);
      expect(after.body?.data.pricing.installationFeeNgn).toBe(0);
      const [row] = await h.db.select().from(quoteCalcAudit).where(eq(quoteCalcAudit.id, after.body?.data.calculationId));
      expect((row?.inputs as { settings: { engine: { safetyMargin: number } } }).settings.engine.safetyMargin).toBe(1);
      const [entry] = await h.db.select().from(auditLog).where(eq(auditLog.action, "SETTINGS_UPDATE"));
      expect(entry?.actorId).toBe(admin.userId);
    } finally {
      await h.request("/api/v1/admin/settings", { method: "PATCH", cookie: admin.cookie, json: { engine: { safetyMargin: 0.3 }, pricing: { installationRate: 0.15 } } });
    }
  });

  it("rejects invalid settings and non-admin changes", async () => {
    const admin = await h.signUp("admin");
    const bad = await h.request("/api/v1/admin/settings", { method: "PATCH", cookie: admin.cookie, json: { engine: { powerFactor: 1.5 } } });
    expect(bad.status).toBe(400);
    const unknown = await h.request("/api/v1/admin/settings", { method: "PATCH", cookie: admin.cookie, json: { engine: { madeUp: 1 } } });
    expect(unknown.status).toBe(400);
    const consumer = await h.signUp();
    expect((await h.request("/api/v1/admin/settings", { method: "PATCH", cookie: consumer.cookie, json: { pricing: { vatRate: 0 } } })).status).toBe(403);
    const read = await h.request("/api/v1/admin/settings", { cookie: admin.cookie });
    expect(read.body?.data.engine.powerFactor).toBe(0.8);
  });

  it("lists the panels customers can choose and sizes with the chosen one", async () => {
    const list = await h.request("/api/v1/panels");
    const panels = list.body?.data as { id: string; model: string; wattsPeak: number; performanceFactor: number }[];
    expect(panels.map((p) => p.model)).toEqual(expect.arrayContaining(["Jinko 620W", "JA Solar 590W", "Flames 600W"]));
    expect(panels.find((p) => p.model === "Flames 600W")?.performanceFactor).toBe(0.65);

    const pick = async (model: string) => {
      const res = await h.request("/api/v1/calculate", {
        method: "POST",
        headers: guest(),
        json: { ...(await ref001Body()), panelId: panels.find((p) => p.model === model)!.id },
      });
      expect(res.status).toBe(200);
      return res.body?.data.system.panels as { model: string; count: number };
    };
    const jinko = await pick("Jinko 620W");
    const flames = await pick("Flames 600W");
    expect(jinko.model).toBe("Jinko 620W");
    expect(flames.model).toBe("Flames 600W");
    expect(flames.count).toBeGreaterThan(jinko.count); // 65% vs 80% efficiency

    const bad = await h.request("/api/v1/calculate", { method: "POST", headers: guest(), json: { ...(await ref001Body()), panelId: crypto.randomUUID() } });
    expect(bad.status).toBe(400);
    expect(bad.body?.error.field).toBe("panelId");
  });

  it("rate-limits signed-in users to 10/min and guests to 60/min per IP", async () => {
    const body = await ref001Body();
    const { cookie } = await h.signUp();
    const userStatuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      userStatuses.push((await h.request("/api/v1/calculate", { method: "POST", cookie, headers: guest(), json: body })).status);
    }
    expect(userStatuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(userStatuses[10]).toBe(429);

    // Guests sharing one IP get a larger allowance; check the boundary via the counter.
    const headers = guest();
    expect((await h.request("/api/v1/calculate", { method: "POST", headers, json: body })).status).toBe(200);
    const ip = headers["x-forwarded-for"];
    await h.db.update(rateLimits).set({ count: 60 }).where(eq(rateLimits.key, `calculate:ip:${ip}`));
    expect((await h.request("/api/v1/calculate", { method: "POST", headers, json: body })).status).toBe(429);

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
