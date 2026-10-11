import { APPLIANCES, BATTERIES, INVERTERS, PANELS, SUN_HOUR_REGIONS } from "../../db/seed/data";
import type { Catalogue, LoadItem, SunHoursInput } from "../types";

/** The seeded Felicity catalogue, shaped for the engine (ids = SKUs for readability). */
export function seedCatalogue(): Catalogue {
  return {
    inverters: INVERTERS.map((i) => ({ id: i.sku, sku: i.sku, model: i.model, kva: i.kva, dcVoltage: i.dcVoltage, unitPriceNgn: i.unitPriceNgn, maxPvInputW: null })),
    batteries: BATTERIES.map((b) => ({ id: b.sku, sku: b.sku, model: b.model, chemistry: b.chemistry, dcVoltage: b.dcVoltage, capacityKwh: b.capacityKwh, capacityAh: b.capacityAh, unitPriceNgn: b.unitPriceNgn })),
    panels: PANELS.map((p) => ({ id: p.sku, sku: p.sku, model: p.model, wattsPeak: p.wattsPeak, unitPriceNgn: p.unitPriceNgn })),
  };
}

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
