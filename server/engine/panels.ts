import type { ChemistryParams } from "./constants";
import { PANEL_DERATING, SYSTEM_LOSS_FACTOR } from "./constants";
import { EngineError } from "./errors";
import { ceilSafe } from "./math";
import type { LoadProfile, PanelSizing, PanelSku, SunHoursInput } from "./types";

/**
 * Panels must cover daytime consumption AND replace the energy drawn from the
 * battery overnight (PRD §13.5 — never max(day, recharge)).
 *
 * Recharge energy is what the battery actually delivered, grossed up for the
 * inverter and battery round-trip losses (agreed v1.1 rule; not nameplate capacity).
 * Sized on wet-season sun hours so the system works all year (agreed v1.1 rule).
 */
export function sizePanels(
  load: LoadProfile,
  params: ChemistryParams,
  sunHours: SunHoursInput,
  panels: PanelSku[],
): PanelSizing {
  if (panels.length === 0) {
    throw new EngineError("NO_SKU_AVAILABLE", "No solar panels are currently available in the catalogue.", "panels");
  }
  const rechargeEnergyKwh = load.nightEnergyKwh / params.inverterEfficiency / params.roundTripEfficiency;
  const totalPanelEnergyKwh = load.dayEnergyKwh + rechargeEnergyKwh;
  const effectiveFactor = PANEL_DERATING * SYSTEM_LOSS_FACTOR;
  const designSunHours = sunHours.wetSeason;
  const requiredKwp = totalPanelEnergyKwh / (designSunHours * effectiveFactor);

  // Cheapest array that meets the requirement; fewer panels breaks ties.
  const options = panels.map((panel) => {
    const count = Math.max(1, ceilSafe(requiredKwp / (panel.wattsPeak / 1000)));
    return { panel, count, cost: count * panel.unitPriceNgn };
  });
  options.sort((a, b) => a.cost - b.cost || a.count - b.count);
  const best = options[0]!;
  const arrayKwp = (best.count * best.panel.wattsPeak) / 1000;

  return {
    rechargeEnergyKwh,
    totalPanelEnergyKwh,
    designSunHours,
    requiredKwp,
    panel: best.panel,
    count: best.count,
    arrayKwp,
    wetSeasonYieldKwh: arrayKwp * sunHours.wetSeason * effectiveFactor,
    drySeasonYieldKwh: arrayKwp * sunHours.drySeason * effectiveFactor,
  };
}
