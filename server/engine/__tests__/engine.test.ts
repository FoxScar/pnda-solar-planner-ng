import { describe, expect, it } from "vitest";
import { DEFAULT_PRICING_SETTINGS, periodWindows } from "../../../shared/settings";
import { requiredBatteryKwh, selectBattery } from "../battery";
import { assertCompatible } from "../guard";
import { calculateSystem, EngineError, priceBom } from "../index";
import { ceilSafe, round } from "../math";
import { checkPvInput, sizePanels } from "../panels";
import type { EngineInput } from "../types";
import { battery, flatSunHours, inverter, load, panel, regionSunHours, seedCatalogue, settings } from "./fixtures";

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    loads: [load("Ceiling Fan", 2, 8, 8), load('TV (43" LED)', 1, 4, 4)],
    sunHours: regionSunHours("South-West"),
    batteryChemistry: "lithium",
    engineerOverride: false,
    catalogue: seedCatalogue(),
    settings: settings(),
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

const codes = (r: { warnings: { code: string }[] }) => r.warnings.map((w) => w.code);

describe("input rules", () => {
  it("rejects an empty appliance list", () => {
    expectEngineError(() => calculateSystem(input({ loads: [] })), "INVALID_PAYLOAD");
  });

  it("rejects lead-acid for any system with an air conditioner", () => {
    const loads = [load("Air Conditioner (1HP)", 1, 4, 0)];
    for (const chemistry of ["gel", "tubular"] as const) {
      expectEngineError(() => calculateSystem(input({ loads, batteryChemistry: chemistry })), "CHEMISTRY_RESTRICTED");
    }
  });

  it("allows lead-acid with AC under an engineer override, with a warning", () => {
    const r = calculateSystem(input({ loads: [load("Air Conditioner (1HP)", 1, 4, 2)], batteryChemistry: "gel", engineerOverride: true }));
    expect(r.batteryChemistry).toBe("gel");
    expect(codes(r)).toContain("ENGINEER_OVERRIDE_LEAD_ACID_AC");
  });

  it("warns on the national sun-hour fallback and rejects missing sun hours", () => {
    expect(codes(calculateSystem(input({ sunHours: { ...flatSunHours(4.5), isFallback: true } })))).toContain("SUN_HOURS_FALLBACK");
    expectEngineError(() => calculateSystem(input({ sunHours: flatSunHours(0) })), "STATE_NOT_FOUND");
  });

  it("uses the configured sun-hour basis", () => {
    const sun = regionSunHours("South-South");
    expect(calculateSystem(input({ sunHours: sun })).panels.sunHours).toBe(sun.wetSeason);
    expect(calculateSystem(input({ sunHours: sun, settings: settings({ sunHoursBasis: "dry" }) })).panels.sunHours).toBe(sun.drySeason);
    expect(calculateSystem(input({ sunHours: sun, settings: settings({ sunHoursBasis: "annual" }) })).panels.sunHours).toBe(sun.annualAvg);
  });
});

describe("load assessment (§1)", () => {
  it("separates energy and peak per period, all-overlap, with one start-up surge", () => {
    const r = calculateSystem(input({ loads: [load("Ceiling Fan", 2, 8, 0), load("Water Pump (1HP)", 1, 1, 0), load("LED Bulb (9W)", 4, 0, 5)] }));
    expect(r.load.dayEnergyKwh).toBeCloseTo(1.2 + 0.75, 9);
    expect(r.load.nightEnergyKwh).toBeCloseTo(0.18, 9);
    expect(r.load.totalEnergyKwh).toBeCloseTo(2.13, 9);
    expect(r.load.dayPeakW).toBe(900);
    expect(r.load.nightPeakW).toBe(36);
    expect(r.load.peakW).toBe(900);
    expect(r.load.surgeRequirementW).toBe(900 + 750 * 1.5); // pump surge ×2.5
    expect(r.load.hasAirConditioner).toBe(false);
  });

  it("applies the start-up surge of a single unit even when quantity > 1", () => {
    const r = calculateSystem(input({ loads: [load("Refrigerator (Single Door)", 3, 10, 0)] }));
    expect(r.load.surgeRequirementW).toBe(450 + 150);
  });
});

describe("inverter sizing (§2)", () => {
  it("flags loads above 12kVA instead of capping (OVERSIZE_REQUIRED)", () => {
    const err = expectEngineError(() => calculateSystem(input({ loads: [load("Air Conditioner (2HP)", 6, 0, 8)] })), "OVERSIZE_REQUIRED");
    expect(err.details?.requiredVa).toBeGreaterThan(12_000);
  });

  it("reports NO_SKU_AVAILABLE when nothing in stock meets the VA requirement", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters = catalogue.inverters.filter((i) => i.kva < 4);
    expectEngineError(() => calculateSystem(input({ loads: [load("Air Conditioner (1.5HP)", 2, 0, 8)], catalogue })), "NO_SKU_AVAILABLE");
  });

  it("rejects an inverter whose recorded surge rating is too low and moves up", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters = catalogue.inverters.map((i) => (i.kva === 1.8 ? { ...i, continuousW: 1800, surgeW: 600 } : i));
    const r = calculateSystem(input({ loads: [load("Refrigerator (Single Door)", 1, 10, 10)], catalogue })); // 300 W start-up
    expect(r.inverter.inverter.kva).toBe(1.8);
    const weak = calculateSystem(input({ loads: [load("Water Pump (1HP)", 1, 1, 0)], catalogue })); // 1,875 W start-up
    expect(weak.inverter.inverter.kva).toBe(3);
  });

  it("uses recorded specs and efficiency, and only warns when ratings are assumed", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters = catalogue.inverters.map((i) => ({ ...i, continuousW: i.kva * 1000, surgeW: i.kva * 2000, efficiency: 0.93 }));
    const r = calculateSystem(input({ catalogue }));
    expect(r.inverter.efficiency).toBe(0.93);
    expect(r.inverter.specsAssumed).toBe(false);
    expect(codes(r)).not.toContain("INVERTER_SPECS_ASSUMED");
    expect(r.validation.checks.find((c) => c.id === "inverter")?.status).toBe("passed");
    expect(codes(calculateSystem(input()))).toContain("INVERTER_SPECS_ASSUMED");
  });

  it("picks the cheaper of two inverters with the same rating", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters.push({ ...catalogue.inverters[0]!, id: "cheap", sku: "INV-ALT-1K8-24", unitPriceNgn: 1 });
    expect(calculateSystem(input({ catalogue })).inverter.inverter.sku).toBe("INV-ALT-1K8-24");
  });

  it("skips an inverter with no compatible battery bank and takes the next valid one", () => {
    const catalogue = seedCatalogue();
    catalogue.batteries = catalogue.batteries.filter((b) => b.dcVoltage !== 24);
    const r = calculateSystem(input({ catalogue }));
    expect(r.inverter.inverter.kva).toBe(5);
    expect(r.systemVoltage).toBe(48);
  });

  it("reports the specific battery limitation when only one inverter qualifies", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters = catalogue.inverters.filter((i) => i.kva === 1.8);
    catalogue.batteries = catalogue.batteries.filter((b) => b.dcVoltage !== 24);
    const err = expectEngineError(() => calculateSystem(input({ catalogue })), "NO_SKU_AVAILABLE");
    expect(err.field).toBe("batteryChemistry");
  });
});

describe("battery sizing (§3)", () => {
  it("follows the schematic formula", () => {
    expect(requiredBatteryKwh(14.675, 0.3, 0.8, 0.9, 0.95)).toBeCloseTo(27.89, 2);
    expect(requiredBatteryKwh(10, 0, 1, 1, 1)).toBe(10);
  });

  it("includes the smallest bank when there is no night use", () => {
    const r = calculateSystem(input({ loads: [load("Ceiling Fan", 2, 8, 0)] }));
    expect(r.battery.requiredKwh).toBe(0);
    expect(r.battery.totalUnits).toBe(1);
    expect(codes(r)).toContain("MINIMUM_BATTERY_APPLIED");
  });

  it("prefers fewest units, then least installed capacity, then lowest price", () => {
    const req = { nightEnergyKwh: 3, chemistry: "lithium" as const, systemVoltage: 24, inverterEfficiency: 0.9, dischargeDemandW: 100 };
    const batteries = [
      battery({ sku: "A", capacityKwh: 10, unitPriceNgn: 100 }),
      battery({ sku: "B", capacityKwh: 7, unitPriceNgn: 50 }),
      battery({ sku: "C", capacityKwh: 7, unitPriceNgn: 40 }),
      battery({ sku: "D", capacityKwh: 3, unitPriceNgn: 1 }),
    ];
    // 3 kWh × 1.3 ÷ 0.684 = 5.70 kWh: A/B/C need 1 unit, D needs 2; B and C install 7 kWh; C is cheaper.
    expect(selectBattery(req, batteries, settings()).battery.sku).toBe("C");
  });

  it("uses product DoD and efficiency over chemistry defaults", () => {
    const req = { nightEnergyKwh: 10, chemistry: "lithium" as const, systemVoltage: 48, inverterEfficiency: 1, dischargeEfficiency: 1, dischargeDemandW: 0 };
    const r = selectBattery(req, [battery({ dcVoltage: 48, capacityKwh: 5, depthOfDischarge: 1, dischargeEfficiency: 1 })], settings({ safetyMargin: 0 }));
    expect(r.requiredKwh).toBe(10);
    expect(r.totalUnits).toBe(2);
  });

  it("adds modules when the bank's discharge rating is too low", () => {
    const req = { nightEnergyKwh: 1, chemistry: "lithium" as const, systemVoltage: 48, inverterEfficiency: 0.9, dischargeDemandW: 9000 };
    const r = selectBattery(req, [battery({ dcVoltage: 48, capacityKwh: 10, maxDischargeW: 5000 })], settings());
    expect(r.totalUnits).toBe(2); // energy needs 1, power needs 2
    expect(r.bankDischargeW).toBe(10_000);
  });

  it("builds lead-acid strings from 12V blocks, deriving Ah when absent", () => {
    const req = { nightEnergyKwh: 3, chemistry: "gel" as const, systemVoltage: 48, inverterEfficiency: 0.9, dischargeDemandW: 0 };
    const r = selectBattery(req, [battery({ chemistry: "gel", dcVoltage: 12, capacityKwh: 2.4, capacityAh: null })], settings());
    // 3 × 1.3 ÷ (0.5 × 0.9 × 0.85) = 10.196 kWh → 212.4 Ah at 48V → 2 strings of 4 × 200Ah
    expect(r.seriesCount).toBe(4);
    expect(r.parallelStrings).toBe(2);
    expect(r.totalUnits).toBe(8);
  });

  it("never mixes gel and tubular", () => {
    expect(calculateSystem(input({ batteryChemistry: "gel" })).battery.battery.chemistry).toBe("gel");
  });
});

describe("panel sizing (§4) and PV input (§5)", () => {
  it("applies the combined rule from installed battery capacity and the product factor", () => {
    const r = calculateSystem(input());
    expect(r.panels.effectivePanelW).toBeCloseTo(320, 9);
    expect(r.panels.chargingW).toBeCloseTo((r.battery.installedKwh * 1000) / r.panels.sunHours, 9);
    expect(r.panels.combinedW).toBeCloseTo(r.load.peakW + r.panels.chargingW, 9);
    expect(r.panels.estimatedPvEnergyKwh).toBeGreaterThanOrEqual(r.panels.requiredEnergyKwh);
  });

  it("chooses the cheapest array, breaking ties with fewer panels", () => {
    const profile = { dayEnergyKwh: 0, nightEnergyKwh: 0, totalEnergyKwh: 0, dayPeakW: 1280, nightPeakW: 0, peakW: 1280, surgeRequirementW: 1280, hasAirConditioner: false };
    const options = [
      panel({ sku: "P400", wattsPeak: 400, unitPriceNgn: 100 }), // 1,280 ÷ 320 = 4 panels, ₦400
      panel({ sku: "P800", wattsPeak: 800, unitPriceNgn: 200 }), // 1,280 ÷ 640 = 2 panels, ₦400
      panel({ sku: "P550", wattsPeak: 550, unitPriceNgn: 1000 }),
    ];
    expect(sizePanels(profile, 0, 5, options, inverter({}))!.panel.sku).toBe("P800");
    expect(sizePanels(profile, 0, 5, [options[0]!, { ...options[1]!, unitPriceNgn: 201 }], inverter({}))!.panel.sku).toBe("P400");
  });

  it("sizes each panel brand with its own performance factor", () => {
    const all = seedCatalogue({ allPanels: true });
    const only = (sku: string) => calculateSystem(input({ catalogue: { ...all, panels: all.panels.filter((p) => p.sku === sku) } })).panels;
    const jinko = only("PNL-JINKO-620");
    const ja = only("PNL-JA-590");
    const flames = only("PNL-FLAMES-600");
    expect(jinko.effectivePanelW).toBeCloseTo(496, 9); // 620 × 0.80
    expect(ja.effectivePanelW).toBeCloseTo(472, 9); // 590 × 0.80
    expect(flames.effectivePanelW).toBeCloseTo(390, 9); // 600 × 0.65
    expect(flames.count).toBeGreaterThan(jinko.count);
    expect(calculateSystem(input({ catalogue: all })).panels.panel.sku).toMatch(/^PNL-/);
  });

  it("reports NO_SKU_AVAILABLE with no panels in stock", () => {
    expectEngineError(() => calculateSystem(input({ catalogue: { ...seedCatalogue(), panels: [] } })), "NO_SKU_AVAILABLE");
  });

  it("checks PV power, string voltage and current when data is on record", () => {
    const p = panel({ wattsPeak: 400, voc: 40, isc: 10 });
    const full = inverter({ maxPvInputW: 4000, maxPvVoc: 450, maxPvIsc: 22, mpptCount: 1 });
    // 450 ÷ (40 × 1.05) = 10 in series; 22 ÷ 10 = 2 strings → 20 panels, but 4,000 W caps it at 10
    expect(checkPvInput(full, p, 10)).toBe("passed");
    expect(checkPvInput(full, p, 11)).toBe("failed");
    expect(checkPvInput({ ...full, maxPvInputW: 100_000 }, p, 21)).toBe("failed");
    expect(checkPvInput({ ...full, maxPvInputW: 100_000, mpptCount: null }, p, 20)).toBe("passed");
    expect(checkPvInput(inverter({ maxPvInputW: 4000 }), p, 5)).toBe("unverified");
    expect(checkPvInput(inverter({ maxPvVoc: 450, maxPvIsc: 22 }), p, 5)).toBe("unverified");
  });

  it("moves to a larger inverter when the array exceeds the PV input, and fails when none fits", () => {
    const catalogue = seedCatalogue();
    catalogue.inverters = catalogue.inverters.map((i) => ({ ...i, maxPvInputW: i.kva <= 3 ? 1000 : 50_000, maxPvVoc: 500, maxPvIsc: 100, mpptCount: 2 }));
    catalogue.panels = catalogue.panels.map((p) => ({ ...p, voc: 40, isc: 10 }));
    const r = calculateSystem(input({ catalogue }));
    expect(r.inverter.inverter.kva).toBe(4);
    expect(r.panels.pvInput).toBe("passed");
    expect(codes(r)).not.toContain("PV_INPUT_UNVERIFIED");

    const tiny = { ...catalogue, inverters: catalogue.inverters.map((i) => ({ ...i, maxPvInputW: 500 })) };
    const err = expectEngineError(() => calculateSystem(input({ catalogue: tiny })), "NO_SKU_AVAILABLE");
    expect((err.details?.reasons as string[]).length).toBeGreaterThan(1);
  });

  it("refuses unverified PV input when the setting requires verified limits", () => {
    expect(codes(calculateSystem(input()))).toContain("PV_INPUT_UNVERIFIED");
    expectEngineError(() => calculateSystem(input({ settings: settings({ requireVerifiedPvLimits: true }) })), "NO_SKU_AVAILABLE");
  });
});

describe("validation report", () => {
  it("lists every schematic check and marks the system quote-eligible", () => {
    const r = calculateSystem(input());
    expect(r.validation.checks.map((c) => c.id)).toEqual([
      "inverter",
      "battery_voltage",
      "battery_bank",
      "panel_count",
      "pv_input",
      "energy_sufficiency",
      "inventory",
    ]);
    expect(r.validation.quoteEligible).toBe(true);
    expect(r.validation.checks.find((c) => c.id === "battery_bank")?.status).toBe("unverified");
  });

  it("reports the bank discharge check as passed when ratings are on record", () => {
    const catalogue = seedCatalogue();
    catalogue.batteries = catalogue.batteries.map((b) => ({ ...b, maxDischargeW: 5000 }));
    expect(calculateSystem(input({ catalogue })).validation.checks.find((c) => c.id === "battery_bank")?.status).toBe("passed");
  });
});

describe("compatibility guard", () => {
  it("accepts valid lithium and lead-acid banks", () => {
    expect(() => assertCompatible(inverter({ dcVoltage: 24 }), [{ battery: battery({ dcVoltage: 24 }), seriesCount: 1 }])).not.toThrow();
    expect(() => assertCompatible(inverter({ kva: 5, dcVoltage: 48 }), [{ battery: battery({ chemistry: "tubular", dcVoltage: 12 }), seriesCount: 4 }])).not.toThrow();
  });

  it("rejects inverters ≥5kVA on a 24V bus and mismatched bank voltages", () => {
    expectEngineError(() => assertCompatible(inverter({ kva: 5, dcVoltage: 24 }), [{ battery: battery({}), seriesCount: 1 }]), "VOLTAGE_MISMATCH");
    expectEngineError(() => assertCompatible(inverter({ dcVoltage: 24 }), [{ battery: battery({ dcVoltage: 48 }), seriesCount: 1 }]), "VOLTAGE_MISMATCH");
    expectEngineError(() => assertCompatible(inverter({ kva: 5, dcVoltage: 48 }), [{ battery: battery({ dcVoltage: 24 }), seriesCount: 2 }]), "VOLTAGE_MISMATCH");
    expectEngineError(() => assertCompatible(inverter({ dcVoltage: 24 }), [{ battery: battery({ chemistry: "gel", dcVoltage: 12 }), seriesCount: 4 }]), "VOLTAGE_MISMATCH");
  });

  it("rejects mixed chemistries and mixed models", () => {
    expectEngineError(
      () => assertCompatible(inverter({}), [{ battery: battery({ sku: "L" }), seriesCount: 1 }, { battery: battery({ sku: "G", chemistry: "gel", dcVoltage: 12 }), seriesCount: 2 }]),
      "CHEMISTRY_MIXED",
    );
    expectEngineError(
      () => assertCompatible(inverter({}), [{ battery: battery({ sku: "L5" }), seriesCount: 1 }, { battery: battery({ sku: "L10", capacityKwh: 10 }), seriesCount: 1 }]),
      "CAPACITY_MIXED",
    );
  });
});

describe("quotation pricing (§6)", () => {
  const bom = [
    { componentId: "a", sku: "a", type: "inverter" as const, model: "a", quantity: 1, unitPriceNgn: 1_000_000 },
    { componentId: "b", sku: "b", type: "battery" as const, model: "b", quantity: 2, unitPriceNgn: 500_000 },
  ];

  it("subtotal + installation fee + other fees − discounts, then VAT", () => {
    const p = priceBom(bom, { installationRate: 0.15, vatRate: 0.075, labourFlatFeeNgn: 100_000, discountNgn: 50_000 });
    expect(p.equipmentSubtotalNgn).toBe(2_000_000);
    expect(p.installationFeeNgn).toBe(300_000);
    expect(p.vatNgn).toBe(Math.round((2_000_000 + 300_000 + 100_000 - 50_000) * 0.075));
    expect(p.totalNgn).toBe(2_350_000 + p.vatNgn);
  });

  it("matches the schematic exactly with VAT set to zero", () => {
    const p = priceBom(bom, { installationRate: 0.1, vatRate: 0 });
    expect(p.totalNgn).toBe(2_200_000);
    expect(p.vatNgn).toBe(0);
  });

  it("folds installer margin into unit prices (never shown separately)", () => {
    const p = priceBom([{ ...bom[1]!, quantity: 3, unitPriceNgn: 333_333 }], { ...DEFAULT_PRICING_SETTINGS, marginPct: 10 });
    expect(p.lines[0]!.unitPriceNgn).toBe(366_666);
    expect(p.marginNgn).toBe(1_099_998 - 999_999);
  });
});

describe("helpers", () => {
  it("derives day/night windows from the configured night start and end", () => {
    expect(periodWindows({ nightStart: "17:00", nightEnd: "06:00" })).toEqual({ nightHours: 13, dayHours: 11 });
    expect(periodWindows({ nightStart: "18:30", nightEnd: "06:30" })).toEqual({ nightHours: 12, dayHours: 12 });
  });

  it("ceilSafe ignores floating-point noise; round rounds", () => {
    expect(ceilSafe(7.000000000001)).toBe(7);
    expect(ceilSafe(7.01)).toBe(8);
    expect(round(1.23456)).toBe(1.235);
  });
});
