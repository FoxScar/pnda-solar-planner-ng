import { PV_VOC_COLD_FACTOR } from "./constants";
import { EngineError } from "./errors";
import { ceilSafe } from "./math";
import type { InverterSku, LoadProfile, PanelSizing, PanelSku, PvCheck } from "./types";

/**
 * PV input check against the inverter (schematics §5): array power, and — when
 * both products carry electrical data — how many panels the MPPT inputs can
 * take within their voltage and current limits.
 * Returns "failed" when a known limit is exceeded, "unverified" when a limit is unknown.
 */
export function checkPvInput(inv: InverterSku, panel: PanelSku, count: number): PvCheck | "failed" {
  let complete = true;
  if (inv.maxPvInputW === null) complete = false;
  else if (count * panel.wattsPeak > inv.maxPvInputW) return "failed";

  if (inv.maxPvVoc !== null && inv.maxPvIsc !== null && panel.voc !== null && panel.isc !== null) {
    const maxSeries = Math.floor(inv.maxPvVoc / (panel.voc * PV_VOC_COLD_FACTOR));
    const maxParallel = Math.floor(inv.maxPvIsc / panel.isc) * (inv.mpptCount ?? 1);
    if (count > maxSeries * maxParallel) return "failed";
  } else {
    complete = false;
  }
  return complete ? "passed" : "unverified";
}

/**
 * Schematics §4:
 *   effective W   = rated W × product performance factor
 *   charging W    = battery nominal kWh × 1000 ÷ sun-hours
 *   combined rule = ceil((peak W + charging W) ÷ effective W)
 *   energy check  = count × effective W × sun-hours ÷ 1000 ≥ day kWh + battery nominal kWh
 * When the combined rule fails the energy check, the count is raised to the
 * smallest that passes (the "next valid configuration").
 * Returns the cheapest valid array for this inverter, or null if none fits its PV input.
 */
export function sizePanels(
  load: LoadProfile,
  batteryKwh: number,
  sunHours: number,
  panels: PanelSku[],
  inverter: InverterSku,
): PanelSizing | null {
  if (panels.length === 0) {
    throw new EngineError("NO_SKU_AVAILABLE", "No solar panels are currently available in the catalogue.", "panels");
  }
  const chargingW = (batteryKwh * 1000) / sunHours;
  const combinedW = load.peakW + chargingW;
  const requiredEnergyKwh = load.dayEnergyKwh + batteryKwh;

  const options = panels.flatMap((panel) => {
    const effectivePanelW = panel.wattsPeak * panel.performanceFactor;
    const combinedRuleCount = Math.max(1, ceilSafe(combinedW / effectivePanelW));
    const energyCheckCount = Math.max(1, ceilSafe((requiredEnergyKwh * 1000) / (effectivePanelW * sunHours)));
    const count = Math.max(combinedRuleCount, energyCheckCount);
    const pvInput = checkPvInput(inverter, panel, count);
    if (pvInput === "failed") return [];
    const sizing: PanelSizing = {
      panel,
      sunHours,
      effectivePanelW,
      chargingW,
      combinedW,
      combinedRuleCount,
      energyCheckCount,
      count,
      governedBy: energyCheckCount > combinedRuleCount ? "energy_check" : "combined_rule",
      arrayWattsPeak: count * panel.wattsPeak,
      estimatedPvEnergyKwh: (count * effectivePanelW * sunHours) / 1000,
      requiredEnergyKwh,
      pvInput,
    };
    return [{ sizing, cost: count * panel.unitPriceNgn }];
  });
  if (options.length === 0) return null;
  options.sort((a, b) => a.cost - b.cost || a.sizing.count - b.sizing.count);
  return options[0]!.sizing;
}
