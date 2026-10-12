import { describe, expect, it } from "vitest";
import { requiredBatteryKwh, selectBattery } from "../battery";
import { CHEMISTRY_PARAMS } from "../constants";
import { assertCompatible } from "../guard";
import { calculateSystem, EngineError, priceBom } from "../index";
import { ceilSafe, round } from "../math";
import type { BatterySku, EngineInput, InverterSku } from "../types";
import { load, regionSunHours, seedCatalogue } from "./fixtures";

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    loads: [load("Ceiling Fan", 2, 8, 8), load('TV (43" LED)', 1, 4, 4)],
    sunHours: regionSunHours("South-West"),
    batteryChemistry: "lithium",
    engineerOverride: false,
    catalogue: seedCatalogue(),
    ...overrides,
  };
}

function expectEngineError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(EngineError);
    expect((err as EngineError).code).toBe(code);
    expect((err as EngineError).message.length).toBeGreaterThan(10);
    return err as EngineError;
  }
  throw new Error(`Expected EngineError ${code}, but nothing was thrown`);
}

const inv = (over: Partial<InverterSku>): InverterSku => ({
  id: "i", sku: "INV", model: "Test inverter", kva: 3, dcVoltage: 24, unitPriceNgn: 1, maxPvInputW: null, ...over,
});
const bat = (over: Partial<BatterySku>): BatterySku => ({
  id: "b", sku: "BAT", model: "Test battery", chemistry: "lithium", dcVoltage: 24, capacityKwh: 5, capacityAh: null, unitPriceNgn: 1, ...over,
});

describe("input rules", () => {
  it("rejects an empty appliance list", () => {
    expectEngineError(() => calculateSystem(input({ loads: [] })), "INVALID_PAYLOAD");
  });

  it("rejects lead-acid for any system with an air conditioner (v1.1 rule 3)", () => {
    const loads = [load("Air Conditioner (1HP)", 1, 4, 0)];
    for (const chemistry of ["gel", "tubular"] as const) {
      expectEngineError(() => calculateSystem(input({ loads, batteryChemistry: chemistry })), "CHEMISTRY_RESTRICTED");
    }
  });

  it("allows lead-acid with AC under an engineer override, with a warning", () => {
    const r = calculateSystem(input({ loads: [load("Air Conditioner (1HP)", 1, 4, 2)], batteryChemistry: "gel", engineerOverride: true }));
    expect(r.batteryChemistry).toBe("gel");
    expect(r.warnings.map((w) => w.code)).toContain("ENGINEER_OVERRIDE_LEAD_ACID_AC");
  });

  it("warns when the national sun-hour fallback was used", () => {
    const r = calculateSystem(input({ sunHours: { wetSeason: 4.5, drySeason: 4.5, annualAvg: 4.5, isFallback: true } }));
    expect(r.warnings.map((w) => w.code)).toContain("SUN_HOURS_FALLBACK");
  });
});

describe("load profile", () => {
  it("counts only appliances active in each period and adds one surge delta", () => {
    const r = calculateSystem(input({ loads: [load("Ceiling Fan", 2, 8, 0), load("Water Pump (1HP)", 1, 1, 0), load("LED Bulb (9W)", 4, 0, 5)] }));
    // Day: 150 + 750 running, pump surge delta 750 × 1.5 = 1125 → 2.025kW
    expect(r.load.dayRunningPeakKw).toBeCloseTo(0.9, 9);
    expect(r.load.daySurgePeakKw).toBeCloseTo(2.025, 9);
    expect(r.load.nightRunningPeakKw).toBeCloseTo(0.036, 9);
    expect(r.load.nightSurgePeakKw).toBeCloseTo(0.036, 9);
    expect(r.load.designPeakKw).toBeCloseTo(2.025, 9);
    expect(r.load.hasAirConditioner).toBe(false);
  });

  it("applies the surge of a single unit even when quantity > 1", () => {
    const r = calculateSystem(input({ loads: [load("Refrigerator (Single Door)", 3, 10, 0)] }));
    expect(r.load.daySurgePeakKw).toBeCloseTo(0.45 + 0.15, 9);
  });
});

describe("inverter selection", () => {
  it("flags loads above 12kVA instead of silently capping (OVERSIZE_REQUIRED)", () => {
    const err = expectEngineError(
      () => calculateSystem(input({ loads: [load("Air Conditioner (2HP)", 4, 0, 8)] })),
      "OVERSIZE_REQUIRED",
    );
    expect(err.details?.requiredKva).toBeGreaterThan(12);
  });

  it("reports NO_SKU_AVAILABLE when the needed size is out of stock", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters = catalogue.inverters.filter((i) => i.kva < 8);
    expectEngineError(() => calculateSystem(input({ loads: [load("Air Conditioner (1.5HP)", 2, 0, 8)], catalogue })), "NO_SKU_AVAILABLE");
  });

  it("steps up to an inverter whose charge controller accepts the array", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters = catalogue.inverters.map((i) => ({ ...i, maxPvInputW: i.kva <= 3 ? 1000 : 6000 }));
    const r = calculateSystem(input({ catalogue })); // small load, but array > 1000W
    expect(r.panels.arrayKwp * 1000).toBeGreaterThan(1000);
    expect(r.inverter.inverter.sku).toBe("INV-FEL-4K-24");
    expect(r.warnings.map((w) => w.code)).not.toContain("PV_INPUT_UNVERIFIED");
  });

  it("reports NO_SKU_AVAILABLE when no inverter accepts the array", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters = catalogue.inverters.map((i) => ({ ...i, maxPvInputW: 500 }));
    expectEngineError(() => calculateSystem(input({ catalogue })), "NO_SKU_AVAILABLE");
  });

  it("picks the cheaper of two inverters with the same rating", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters.push({ ...catalogue.inverters[0]!, id: "cheap", sku: "INV-ALT-1K8-24", unitPriceNgn: 1 });
    expect(calculateSystem(input({ catalogue })).inverter.inverter.sku).toBe("INV-ALT-1K8-24");
  });

  it("warns when the selected inverter's PV limit is unknown", () => {
    expect(calculateSystem(input()).warnings.map((w) => w.code)).toContain("PV_INPUT_UNVERIFIED");
  });
});

describe("battery sizing", () => {
  it("follows the PRD formula with chemistry parameters", () => {
    expect(requiredBatteryKwh(10, CHEMISTRY_PARAMS.lithium)).toBeCloseTo((10 / 0.95 / 0.95 / 0.8) * 1.1, 9);
    expect(requiredBatteryKwh(10, CHEMISTRY_PARAMS.tubular)).toBeCloseTo((10 / 0.92 / 0.8 / 0.5) * 1.1, 9);
  });

  it("includes the smallest bank when there is no night use", () => {
    const r = calculateSystem(input({ loads: [load("Ceiling Fan", 2, 8, 0)] }));
    expect(r.battery.requiredKwh).toBe(0);
    expect(r.battery.totalUnits).toBe(1);
    expect(r.battery.battery.sku).toBe("BAT-LI-24-5K");
    expect(r.warnings.map((w) => w.code)).toContain("MINIMUM_BATTERY_APPLIED");
  });

  it("prefers fewest units, then least installed capacity, then lowest price", () => {
    const batteries = [
      bat({ sku: "A", capacityKwh: 10, unitPriceNgn: 100 }),
      bat({ sku: "B", capacityKwh: 7, unitPriceNgn: 50 }),
      bat({ sku: "C", capacityKwh: 7, unitPriceNgn: 40 }),
      bat({ sku: "D", capacityKwh: 3, unitPriceNgn: 1 }),
    ];
    // 6kWh: A/B/C need 1 unit, D needs 2. Among 1-unit options B and C install 7kWh; C is cheaper.
    expect(selectBattery(6, "lithium", 24, batteries).battery.sku).toBe("C");
  });

  it("builds lead-acid strings at 48V from 12V blocks, deriving Ah when absent", () => {
    const r = selectBattery(10, "gel", 48, [bat({ sku: "G", chemistry: "gel", dcVoltage: 12, capacityKwh: 2.4, capacityAh: null })]);
    // 10kWh at 48V = 208.3Ah; a 2.4kWh 12V block is 200Ah → 2 strings of 4
    expect(r.seriesCount).toBe(4);
    expect(r.parallelStrings).toBe(2);
    expect(r.totalUnits).toBe(8);
  });

  it("only considers the requested lead-acid type (never mixes gel and tubular)", () => {
    const r = calculateSystem(input({ batteryChemistry: "gel" }));
    expect(r.battery.battery.chemistry).toBe("gel");
  });

  it("reports NO_SKU_AVAILABLE when no battery matches the system voltage", () => {
    const catalogue = seedCatalogue();
    catalogue.batteries = catalogue.batteries.filter((b) => b.dcVoltage !== 24);
    expectEngineError(() => calculateSystem(input({ catalogue })), "NO_SKU_AVAILABLE");
  });
});

describe("panel sizing", () => {
  it("never uses max(day, recharge): energy is additive", () => {
    const r = calculateSystem(input());
    expect(r.panels.totalPanelEnergyKwh).toBeCloseTo(r.load.dayEnergyKwh + r.panels.rechargeEnergyKwh, 9);
    expect(r.panels.rechargeEnergyKwh).toBeCloseTo(r.load.nightEnergyKwh / 0.95 / 0.95, 9);
  });

  it("sizes on wet-season sun hours and reports dry-season yield", () => {
    const sun = regionSunHours("South-South");
    const r = calculateSystem(input({ sunHours: sun }));
    expect(r.panels.designSunHours).toBe(sun.wetSeason);
    expect(r.panels.wetSeasonYieldKwh).toBeGreaterThanOrEqual(r.panels.totalPanelEnergyKwh);
    expect(r.panels.drySeasonYieldKwh).toBeGreaterThan(r.panels.wetSeasonYieldKwh);
  });

  it("chooses the cheapest array, breaking ties with fewer panels", () => {
    const catalogue = seedCatalogue();
    catalogue.panels = [
      { id: "p1", sku: "P300", model: "300W", wattsPeak: 300, unitPriceNgn: 100 },
      { id: "p2", sku: "P600", model: "600W", wattsPeak: 600, unitPriceNgn: 200 },
      { id: "p3", sku: "P550", model: "550W", wattsPeak: 550, unitPriceNgn: 1000 },
    ];
    const r = calculateSystem(input({ catalogue }));
    // P300 and P600 cost the same per watt; the 600W option uses fewer panels.
    expect(r.panels.panel.sku).toBe("P600");
  });

  it("reports NO_SKU_AVAILABLE with no panels in stock", () => {
    expectEngineError(() => calculateSystem(input({ catalogue: { ...seedCatalogue(), panels: [] } })), "NO_SKU_AVAILABLE");
  });
});

describe("compatibility guard", () => {
  it("accepts valid lithium and lead-acid banks", () => {
    expect(() => assertCompatible(inv({ dcVoltage: 24 }), [{ battery: bat({ dcVoltage: 24 }), seriesCount: 1 }])).not.toThrow();
    expect(() =>
      assertCompatible(inv({ kva: 5, dcVoltage: 48 }), [{ battery: bat({ chemistry: "tubular", dcVoltage: 12 }), seriesCount: 4 }]),
    ).not.toThrow();
  });

  it("rejects inverters ≥5kVA on a 24V bus", () => {
    expectEngineError(() => assertCompatible(inv({ kva: 5, dcVoltage: 24 }), [{ battery: bat({}), seriesCount: 1 }]), "VOLTAGE_MISMATCH");
  });

  it("rejects 48V batteries on a 24V inverter and vice versa", () => {
    expectEngineError(() => assertCompatible(inv({ dcVoltage: 24 }), [{ battery: bat({ dcVoltage: 48 }), seriesCount: 1 }]), "VOLTAGE_MISMATCH");
    expectEngineError(() => assertCompatible(inv({ kva: 5, dcVoltage: 48 }), [{ battery: bat({ dcVoltage: 24 }), seriesCount: 1 }]), "VOLTAGE_MISMATCH");
  });

  it("rejects lithium modules placed in series", () => {
    expectEngineError(() => assertCompatible(inv({ kva: 5, dcVoltage: 48 }), [{ battery: bat({ dcVoltage: 24 }), seriesCount: 2 }]), "VOLTAGE_MISMATCH");
  });

  it("rejects lead-acid strings of the wrong length", () => {
    expectEngineError(
      () => assertCompatible(inv({ dcVoltage: 24 }), [{ battery: bat({ chemistry: "gel", dcVoltage: 12 }), seriesCount: 4 }]),
      "VOLTAGE_MISMATCH",
    );
  });

  it("rejects mixed chemistries and mixed models", () => {
    expectEngineError(
      () =>
        assertCompatible(inv({}), [
          { battery: bat({ sku: "L" }), seriesCount: 1 },
          { battery: bat({ sku: "G", chemistry: "gel", dcVoltage: 12 }), seriesCount: 2 },
        ]),
      "CHEMISTRY_MIXED",
    );
    expectEngineError(
      () =>
        assertCompatible(inv({}), [
          { battery: bat({ sku: "L5" }), seriesCount: 1 },
          { battery: bat({ sku: "L10", capacityKwh: 10 }), seriesCount: 1 },
        ]),
      "CAPACITY_MIXED",
    );
  });
});

describe("result assembly and pricing", () => {
  it("returns a three-line BOM with engine version", () => {
    const r = calculateSystem(input());
    expect(r.bom.map((l) => l.type)).toEqual(["inverter", "battery", "panel"]);
    expect(r.bom[1]!.quantity).toBe(r.battery.totalUnits);
    expect(r.bom[2]!.quantity).toBe(r.panels.count);
    expect(r.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("prices equipment, labour and 7.5% VAT in whole naira", () => {
    const bom = [
      { componentId: "a", sku: "a", type: "inverter" as const, model: "a", quantity: 1, unitPriceNgn: 1_000_000 },
      { componentId: "b", sku: "b", type: "battery" as const, model: "b", quantity: 2, unitPriceNgn: 333_333 },
    ];
    const p = priceBom(bom);
    expect(p).toMatchObject({ equipmentSubtotalNgn: 1_666_666, marginNgn: 0, labourNgn: 0, vatNgn: 125_000, totalNgn: 1_791_666, vatRate: 0.075 });
    expect(p.lines.map((l) => l.lineTotalNgn)).toEqual([1_000_000, 666_666]);
  });

  it("folds installer margin into unit prices and keeps totals consistent", () => {
    const bom = [{ componentId: "b", sku: "b", type: "battery" as const, model: "b", quantity: 3, unitPriceNgn: 333_333 }];
    const p = priceBom(bom, { marginPct: 10, labourFlatFeeNgn: 150_000 });
    expect(p.lines[0]!.unitPriceNgn).toBe(366_666); // 333,333 × 1.1 = 366,666.3 → rounded per unit
    expect(p.equipmentSubtotalNgn).toBe(1_099_998);
    expect(p.marginNgn).toBe(1_099_998 - 999_999);
    expect(p.vatNgn).toBe(Math.round((1_099_998 + 150_000) * 0.075));
    expect(p.totalNgn).toBe(1_099_998 + 150_000 + p.vatNgn);
  });

  it("ceilSafe ignores floating-point noise; round rounds", () => {
    expect(ceilSafe(7.000000000001)).toBe(7);
    expect(ceilSafe(7.01)).toBe(8);
    expect(round(1.23456)).toBe(1.235);
  });
});
