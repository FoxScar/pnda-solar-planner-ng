/**
 * Reference designs (replace PRD §37.4, whose inputs were incomplete).
 * Inputs are pinned here; expected outputs were computed by hand from the
 * v1.1 formulas — see docs/reference-designs.md for the worked arithmetic.
 * Any change to these expectations requires an engineering review.
 */
import { describe, expect, it } from "vitest";
import { calculateSystem } from "../index";
import { load, regionSunHours, seedCatalogue } from "./fixtures";

describe("REF-001 Basic home — Lagos, lithium", () => {
  const result = calculateSystem({
    loads: [
      load("Ceiling Fan", 3, 8, 8),
      load('TV (43" LED)', 1, 4, 4),
      load("LED Bulb (9W)", 5, 0, 6),
      load("Refrigerator (Single Door)", 1, 11, 13),
    ],
    sunHours: regionSunHours("South-West"),
    batteryChemistry: "lithium",
    engineerOverride: false,
    catalogue: seedCatalogue(),
  });

  it("computes the load profile", () => {
    expect(result.load.dayEnergyKwh).toBeCloseTo(3.77, 6);
    expect(result.load.nightEnergyKwh).toBeCloseTo(4.34, 6);
    expect(result.load.daySurgePeakKw).toBeCloseTo(0.605, 6);
    expect(result.load.nightSurgePeakKw).toBeCloseTo(0.65, 6);
  });

  it("selects 1.8kVA 24V, 2 × 5kWh 24V lithium, 8 × 400Wp", () => {
    expect(result.inverter.requiredKvaForLoad).toBeCloseTo(0.8125, 6);
    expect(result.inverter.inverter.sku).toBe("INV-FEL-1K8-24");
    expect(result.systemVoltage).toBe(24);
    expect(result.battery.requiredKwh).toBeCloseTo(6.6122, 3);
    expect(result.battery.battery.sku).toBe("BAT-LI-24-5K");
    expect(result.battery.totalUnits).toBe(2);
    expect(result.panels.requiredKwp).toBeCloseTo(2.9788, 3);
    expect(result.panels.count).toBe(8);
  });
});

describe("REF-002 AC home — Abuja (FCT), lithium", () => {
  const result = calculateSystem({
    loads: [
      load("Air Conditioner (1.5HP)", 2, 0, 8),
      load('TV (55" LED)', 1, 4, 4),
      load("LED Bulb (9W)", 8, 0, 6),
      load("Refrigerator (Double Door)", 1, 11, 13),
      load("Ceiling Fan", 2, 8, 0),
    ],
    sunHours: regionSunHours("Middle Belt"),
    batteryChemistry: "lithium",
    engineerOverride: false,
    catalogue: seedCatalogue(),
  });

  it("sizes the inverter on the night peak, where the ACs run", () => {
    expect(result.load.daySurgePeakKw).toBeCloseTo(0.77, 6);
    expect(result.load.nightSurgePeakKw).toBeCloseTo(5.842, 6);
    expect(result.inverter.requiredKvaForLoad).toBeCloseTo(7.3025, 6);
    expect(result.inverter.inverter.sku).toBe("INV-FEL-8K-48");
    expect(result.systemVoltage).toBe(48);
  });

  it("selects 2 × 25kWh 48V lithium and 23 × 400Wp", () => {
    expect(result.load.nightEnergyKwh).toBeCloseTo(25.762, 6);
    expect(result.battery.requiredKwh).toBeCloseTo(39.2496, 3);
    expect(result.battery.battery.sku).toBe("BAT-LI-48-25K");
    expect(result.battery.totalUnits).toBe(2);
    expect(result.panels.requiredKwp).toBeCloseTo(9.1598, 3);
    expect(result.panels.count).toBe(23);
  });
});

describe("REF-003 Commercial shop — Kano, lithium", () => {
  const loads = [
    load("Photocopier", 1, 4, 0),
    load("Industrial Fan", 2, 10, 0),
    load("Deep Freezer (Commercial)", 1, 11, 13),
    load("LED Tube Light", 6, 10, 2),
  ];
  const base = { loads, sunHours: regionSunHours("Far North"), engineerOverride: false, catalogue: seedCatalogue() };

  it("selects 4kVA 24V, 3 × 5kWh 24V lithium, 14 × 400Wp", () => {
    const r = calculateSystem({ ...base, batteryChemistry: "lithium" });
    expect(r.load.dayEnergyKwh).toBeCloseTo(14.7, 6);
    expect(r.load.nightEnergyKwh).toBeCloseTo(6.74, 6);
    expect(r.load.daySurgePeakKw).toBeCloseTo(2.52, 6);
    expect(r.inverter.inverter.sku).toBe("INV-FEL-4K-24");
    expect(r.battery.requiredKwh).toBeCloseTo(10.2687, 3);
    expect(r.battery.battery.sku).toBe("BAT-LI-24-5K");
    expect(r.battery.totalUnits).toBe(3);
    expect(r.panels.count).toBe(14);
  });

  it("tubular variant: 8 × 220Ah in 2S4P and 16 × 400Wp", () => {
    const r = calculateSystem({ ...base, batteryChemistry: "tubular" });
    expect(r.battery.requiredKwh).toBeCloseTo(20.1467, 3);
    expect(r.battery.battery.sku).toBe("BAT-TUB-12-220");
    expect(r.battery.seriesCount).toBe(2);
    expect(r.battery.parallelStrings).toBe(4);
    expect(r.battery.totalUnits).toBe(8);
    expect(r.panels.requiredKwp).toBeCloseTo(6.0247, 3);
    expect(r.panels.count).toBe(16);
  });
});
