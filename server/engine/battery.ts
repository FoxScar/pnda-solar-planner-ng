import type { BatteryChemistry } from "../../shared/domain";
import type { EngineSettings } from "../../shared/settings";
import { LEAD_ACID_BLOCK_VOLTAGE } from "./constants";
import { EngineError } from "./errors";
import { ceilSafe } from "./math";
import type { BatterySizing, BatterySku } from "./types";

/**
 * Schematics §3: required nominal kWh =
 *   night kWh × (1 + safety margin) ÷ (DoD × inverter efficiency × battery discharge efficiency)
 */
export function requiredBatteryKwh(
  nightEnergyKwh: number,
  safetyMargin: number,
  depthOfDischarge: number,
  inverterEfficiency: number,
  dischargeEfficiency: number,
): number {
  return (nightEnergyKwh * (1 + safetyMargin)) / (depthOfDischarge * inverterEfficiency * dischargeEfficiency);
}

function blockAh(b: BatterySku): number {
  return b.capacityAh ?? (b.capacityKwh * 1000) / b.dcVoltage;
}

export interface BatteryRequest {
  nightEnergyKwh: number;
  chemistry: BatteryChemistry;
  systemVoltage: number;
  inverterEfficiency: number;
  /** Power the bank must be able to deliver (W), for the discharge-rating check. */
  dischargeDemandW: number;
}

function option(b: BatterySku, req: BatteryRequest, settings: EngineSettings): BatterySizing {
  const defaults = settings.chemistryDefaults[b.chemistry];
  const depthOfDischarge = b.depthOfDischarge ?? defaults.depthOfDischarge;
  const dischargeEfficiency = b.dischargeEfficiency ?? defaults.dischargeEfficiency;
  const requiredKwh = requiredBatteryKwh(req.nightEnergyKwh, settings.safetyMargin, depthOfDischarge, req.inverterEfficiency, dischargeEfficiency);

  // Lithium: identical modules at system voltage, in parallel. Lead-acid: 12V blocks in series strings.
  const seriesCount = b.chemistry === "lithium" ? 1 : req.systemVoltage / LEAD_ACID_BLOCK_VOLTAGE;
  const forEnergy =
    b.chemistry === "lithium"
      ? ceilSafe(requiredKwh / b.capacityKwh)
      : ceilSafe((requiredKwh * 1000) / req.systemVoltage / blockAh(b));
  // Discharge power: every unit in the bank contributes its rating.
  const forPower = b.maxDischargeW ? ceilSafe(req.dischargeDemandW / (b.maxDischargeW * seriesCount)) : 0;
  const parallelStrings = Math.max(1, forEnergy, forPower);
  const totalUnits = seriesCount * parallelStrings;
  return {
    requiredKwh,
    depthOfDischarge,
    dischargeEfficiency,
    battery: b,
    seriesCount,
    parallelStrings,
    totalUnits,
    installedKwh: totalUnits * b.capacityKwh,
    bankDischargeW: b.maxDischargeW ? totalUnits * b.maxDischargeW : null,
  };
}

/**
 * Picks the bank with the fewest units (PRD §15.3); ties go to the smallest
 * installed capacity, then the lowest price. One SKU per bank, so capacities
 * and chemistries are never mixed.
 */
export function selectBattery(req: BatteryRequest, batteries: BatterySku[], settings: EngineSettings): BatterySizing {
  const isLithium = req.chemistry === "lithium";
  const candidates = batteries.filter((b) =>
    isLithium
      ? b.chemistry === "lithium" && b.dcVoltage === req.systemVoltage
      : b.chemistry === req.chemistry && b.dcVoltage === LEAD_ACID_BLOCK_VOLTAGE && req.systemVoltage % LEAD_ACID_BLOCK_VOLTAGE === 0,
  );
  if (candidates.length === 0) {
    throw new EngineError(
      "NO_SKU_AVAILABLE",
      `No ${req.chemistry} battery compatible with a ${req.systemVoltage}V system is currently in stock.`,
      "batteryChemistry",
      { chemistry: req.chemistry, systemVoltage: req.systemVoltage },
    );
  }
  const options = candidates.map((b) => option(b, req, settings));
  options.sort(
    (a, b) =>
      a.totalUnits - b.totalUnits ||
      a.installedKwh - b.installedKwh ||
      a.totalUnits * a.battery.unitPriceNgn - b.totalUnits * b.battery.unitPriceNgn,
  );
  return options[0]!;
}
