import { DEFAULT_ENGINE_SETTINGS, type EngineSettings } from "../../../shared/settings";
import { APPLIANCES, BATTERIES, INVERTERS, PANELS, SUN_HOUR_REGIONS } from "../../db/seed/data";
import type { BatterySku, Catalogue, InverterSku, LoadItem, PanelSku, SunHoursInput } from "../types";

export const settings = (over: Partial<EngineSettings> = {}): EngineSettings => ({ ...DEFAULT_ENGINE_SETTINGS, ...over });

const noInverterSpecs = { efficiency: null, continuousW: null, surgeW: null, maxPvInputW: null, maxPvVoc: null, maxPvIsc: null, mpptCount: null };
const noBatterySpecs = { depthOfDischarge: null, dischargeEfficiency: null, maxDischargeW: null };

/**
 * The seeded catalogue, shaped for the engine (ids = SKUs for readability).
 * Panels default to the 400 W reference panel so reference designs stay stable
 * as brands are added; pass `allPanels` for the full seeded range.
 */
export function seedCatalogue({ allPanels = false }: { allPanels?: boolean } = {}): Catalogue {
  return {
    inverters: INVERTERS.map((i) => ({ id: i.sku, sku: i.sku, model: i.model, kva: i.kva, dcVoltage: i.dcVoltage, unitPriceNgn: i.unitPriceNgn, ...noInverterSpecs })),
    batteries: BATTERIES.map((b) => ({ id: b.sku, sku: b.sku, model: b.model, chemistry: b.chemistry, dcVoltage: b.dcVoltage, capacityKwh: b.capacityKwh, capacityAh: b.capacityAh, unitPriceNgn: b.unitPriceNgn, ...noBatterySpecs })),
    panels: PANELS.filter((p) => allPanels || p.sku === "PNL-MONO-400").map((p) => ({ id: p.sku, sku: p.sku, model: p.model, wattsPeak: p.wattsPeak, unitPriceNgn: p.unitPriceNgn, performanceFactor: p.performanceFactor, voc: null, isc: null })),
  };
}

export const inverter = (over: Partial<InverterSku>): InverterSku => ({
  id: "i", sku: "INV", model: "Test inverter", kva: 3, dcVoltage: 24, unitPriceNgn: 1, ...noInverterSpecs, ...over,
});
export const battery = (over: Partial<BatterySku>): BatterySku => ({
  id: "b", sku: "BAT", model: "Test battery", chemistry: "lithium", dcVoltage: 24, capacityKwh: 5, capacityAh: null, unitPriceNgn: 1, ...noBatterySpecs, ...over,
});
export const panel = (over: Partial<PanelSku>): PanelSku => ({
  id: "p", sku: "PNL", model: "Test panel", wattsPeak: 400, unitPriceNgn: 1, performanceFactor: 0.8, voc: null, isc: null, ...over,
});

/** Builds a load line from the seeded appliance catalogue so tests use real wattages. */
export function load(name: string, quantity: number, dayHours: number, nightHours: number): LoadItem {
  const a = APPLIANCES.find((x) => x.name === name);
  if (!a) throw new Error(`Unknown appliance in fixture: ${name}`);
  return { name, watts: a.watts, surgeFactor: a.surgeFactor, isAirConditioner: a.isAirConditioner, quantity, dayHours, nightHours };
}

export function regionSunHours(region: keyof typeof SUN_HOUR_REGIONS): SunHoursInput {
  const r = SUN_HOUR_REGIONS[region]!;
  return { wetSeason: r.wetSeason, drySeason: r.drySeason, annualAvg: r.annualAvg, isFallback: false };
}

export const flatSunHours = (h: number): SunHoursInput => ({ wetSeason: h, drySeason: h, annualAvg: h, isFallback: false });
