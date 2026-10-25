import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { components } from "../db/schema";
import type { BatterySku, Catalogue, InverterSku, PanelSku } from "../engine";

type ComponentRow = typeof components.$inferSelect;

export function toInverter(c: ComponentRow): InverterSku {
  return {
    id: c.id,
    sku: c.sku,
    model: c.model,
    kva: c.kva!,
    dcVoltage: c.dcVoltage!,
    unitPriceNgn: c.unitPriceNgn,
    efficiency: c.efficiency,
    continuousW: c.continuousW,
    surgeW: c.surgeW,
    maxPvInputW: c.maxPvInputW,
    maxPvVoc: c.maxPvVoc,
    maxPvIsc: c.maxPvIsc,
    mpptCount: c.mpptCount,
  };
}

export function toBattery(c: ComponentRow): BatterySku {
  return {
    id: c.id,
    sku: c.sku,
    model: c.model,
    chemistry: c.chemistry!,
    dcVoltage: c.dcVoltage!,
    capacityKwh: c.capacityKwh!,
    capacityAh: c.capacityAh,
    unitPriceNgn: c.unitPriceNgn,
    depthOfDischarge: c.depthOfDischarge,
    dischargeEfficiency: c.dischargeEfficiency,
    maxDischargeW: c.maxDischargeW,
  };
}

export function toPanel(c: ComponentRow): PanelSku {
  return {
    id: c.id,
    sku: c.sku,
    model: c.model,
    wattsPeak: c.wattsPeak!,
    unitPriceNgn: c.unitPriceNgn,
    performanceFactor: c.performanceFactor!,
    voc: c.voc,
    isc: c.isc,
  };
}

/** Active inventory, shaped for the engine. */
export async function loadCatalogue(db: Db): Promise<Catalogue> {
  const rows = await db.select().from(components).where(eq(components.isActive, true));
  return {
    inverters: rows.filter((r) => r.type === "inverter").map(toInverter),
    batteries: rows.filter((r) => r.type === "battery").map(toBattery),
    panels: rows.filter((r) => r.type === "panel").map(toPanel),
  };
}
