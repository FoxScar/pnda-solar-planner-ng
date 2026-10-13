/**
 * Reference designs under the Developer Calculation Schematics (engine 2.0.0).
 * Inputs are pinned; expected outputs were computed by hand with the default
 * settings (PF 0.8, margin 30%, inverter eff 0.90, lithium DoD 0.80 / eff 0.95,
 * lead-acid DoD 0.50 / eff 0.85, panel factor 0.80, wet-season sun hours).
 * Worked arithmetic: docs/reference-designs.md. Changes need engineering review.
 */
import { describe, expect, it } from "vitest";
import { calculateSystem } from "../index";
import { flatSunHours, load, regionSunHours, seedCatalogue, settings } from "./fixtures";

describe("Schematics §8 worked example (owner's sample values)", () => {
  // One all-overlap load reproducing the sample: 4,260 W peak, 14.675 kWh night, 11.41 kWh day.
  const peak = 4260;
  const result = calculateSystem({
    loads: [{ name: "Sample load", watts: peak, surgeFactor: 1, isAirConditioner: false, quantity: 1, dayHours: 11.41 / 4.26, nightHours: 14.675 / 4.26 }],
    sunHours: flatSunHours(5),
    batteryChemistry: "lithium",
    engineerOverride: false,
    catalogue: { ...seedCatalogue(), panels: [{ id: "p650", sku: "PNL-650", model: "650W panel", wattsPeak: 650, unitPriceNgn: 1, performanceFactor: 0.8, voc: null, isc: null }] },
    settings: settings(),
  });

  it("night energy 14.675 kWh, peak 4,260 W → 5,325 VA → 6kVA (5kVA is too small)", () => {
    expect(result.load.nightEnergyKwh).toBeCloseTo(14.675, 9);
    expect(result.load.peakW).toBe(4260);
    expect(result.inverter.requiredVa).toBeCloseTo(5325, 9);
    expect(result.inverter.inverter.kva).toBe(6);
    expect(result.systemVoltage).toBe(48);
  });

  it("required battery ≈ 27.89 kWh → 2 × 15 kWh", () => {
    expect(result.battery.requiredKwh).toBeCloseTo(27.891, 3);
    expect(result.battery.battery.sku).toBe("BAT-LI-48-15K");
    expect(result.battery.totalUnits).toBe(2);
    expect(result.battery.installedKwh).toBe(30);
  });

  it("650 W × 0.80 = 520 W effective; 4,260 + 6,000 W → 20 panels; 52 kWh ≥ 41.41 kWh", () => {
    expect(result.panels.effectivePanelW).toBeCloseTo(520, 9);
    expect(result.panels.chargingW).toBeCloseTo(6000, 9);
    expect(result.panels.combinedW).toBeCloseTo(10260, 9);
    expect(result.panels.count).toBe(20);
    expect(result.panels.governedBy).toBe("combined_rule");
    expect(result.panels.estimatedPvEnergyKwh).toBeCloseTo(52, 9);
    expect(result.panels.requiredEnergyKwh).toBeCloseTo(41.41, 9);
  });
});

describe("REF-001 Basic home — Lagos (wet 4.0h), lithium", () => {
  const r = calculateSystem({
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
    settings: settings(),
  });

  it("load: 3.77 / 4.34 kWh, peak 500 W, start-up 650 W", () => {
    expect(r.load.dayEnergyKwh).toBeCloseTo(3.77, 9);
    expect(r.load.nightEnergyKwh).toBeCloseTo(4.34, 9);
    expect(r.load.dayPeakW).toBe(455);
    expect(r.load.nightPeakW).toBe(500);
    expect(r.load.surgeRequirementW).toBe(650);
  });

  it("1.8kVA 24V; 8.25 kWh → 2 × 5 kWh; 11 panels (daily-energy check governs)", () => {
    expect(r.inverter.inverter.sku).toBe("INV-FEL-1K8-24");
    expect(r.battery.requiredKwh).toBeCloseTo(8.2485, 3);
    expect(r.battery.totalUnits).toBe(2);
    expect(r.panels.combinedRuleCount).toBe(10);
    expect(r.panels.energyCheckCount).toBe(11);
    expect(r.panels.count).toBe(11);
    expect(r.panels.governedBy).toBe("energy_check");
  });
});

describe("REF-002 AC home — Abuja/FCT (wet 5.0h), lithium", () => {
  const r = calculateSystem({
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
    settings: settings(),
  });

  it("sizes on the night peak (3,142 W, 5,842 W start-up) → 4kVA 24V", () => {
    expect(r.load.peakW).toBe(3142);
    expect(r.load.surgeRequirementW).toBe(5842);
    expect(r.inverter.requiredVa).toBeCloseTo(3927.5, 9);
    expect(r.inverter.inverter.sku).toBe("INV-FEL-4K-24");
  });

  it("48.96 kWh → 10 × 5 kWh 24V; 42 panels (combined rule governs)", () => {
    expect(r.battery.requiredKwh).toBeCloseTo(48.963, 3);
    expect(r.battery.totalUnits).toBe(10);
    expect(r.panels.count).toBe(42);
    expect(r.panels.governedBy).toBe("combined_rule");
  });
});

describe("REF-003 Commercial shop — Kano (wet 5.5h)", () => {
  const base = {
    loads: [
      load("Photocopier", 1, 4, 0),
      load("Industrial Fan", 2, 10, 0),
      load("Deep Freezer (Commercial)", 1, 11, 13),
      load("LED Tube Light", 6, 10, 2),
    ],
    sunHours: regionSunHours("Far North"),
    engineerOverride: false,
    catalogue: seedCatalogue(),
    settings: settings(),
  };

  it("lithium: 3kVA 24V, 12.81 kWh → 3 × 5 kWh, 17 panels", () => {
    const r = calculateSystem({ ...base, batteryChemistry: "lithium" });
    expect(r.load.peakW).toBe(2020);
    expect(r.load.surgeRequirementW).toBe(2520);
    expect(r.inverter.inverter.sku).toBe("INV-FEL-3K-24");
    expect(r.battery.requiredKwh).toBeCloseTo(12.8099, 3);
    expect(r.battery.totalUnits).toBe(3);
    expect(r.panels.count).toBe(17);
  });

  it("tubular: 22.91 kWh → 10 × 220Ah (2S5P), 24 panels", () => {
    const r = calculateSystem({ ...base, batteryChemistry: "tubular" });
    expect(r.battery.requiredKwh).toBeCloseTo(22.9072, 3);
    expect(r.battery.battery.sku).toBe("BAT-TUB-12-220");
    expect(r.battery.seriesCount).toBe(2);
    expect(r.battery.parallelStrings).toBe(5);
    expect(r.panels.count).toBe(24);
  });
});
