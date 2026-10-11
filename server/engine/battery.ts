import type { BatteryChemistry } from "../../shared/domain";
import type { ChemistryParams } from "./constants";
import { BATTERY_SAFETY_MARGIN, LEAD_ACID_BLOCK_VOLTAGE } from "./constants";
import { EngineError } from "./errors";
import { ceilSafe } from "./math";
import type { BatterySizing, BatterySku } from "./types";

/** Required kWh = (night kWh ÷ inverter_eff ÷ battery_rte ÷ DoD) × 1.10 (PRD §15.2). */
export function requiredBatteryKwh(nightEnergyKwh: number, params: ChemistryParams): number {
  return (
    (nightEnergyKwh / params.inverterEfficiency / params.roundTripEfficiency / params.depthOfDischarge) *
    BATTERY_SAFETY_MARGIN
  );
}

function blockAh(b: BatterySku): number {
  return b.capacityAh ?? (b.capacityKwh * 1000) / b.dcVoltage;
}

type Option = Omit<BatterySizing, "requiredKwh">;

/** Lithium: identical modules at system voltage, parallel only (PRD §15.3). */
function lithiumOption(b: BatterySku, requiredKwh: number): Option {
  const units = Math.max(1, ceilSafe(requiredKwh / b.capacityKwh));
  return { battery: b, seriesCount: 1, parallelStrings: units, totalUnits: units, installedKwh: units * b.capacityKwh };
}

/** Lead-acid: 12V blocks in series to reach system voltage, strings in parallel for Ah (PRD §15.4). */
function leadAcidOption(b: BatterySku, requiredKwh: number, systemVoltage: number): Option {
  const seriesCount = systemVoltage / LEAD_ACID_BLOCK_VOLTAGE;
  const requiredAh = (requiredKwh * 1000) / systemVoltage;
  const parallelStrings = Math.max(1, ceilSafe(requiredAh / blockAh(b)));
  const totalUnits = seriesCount * parallelStrings;
  return { battery: b, seriesCount, parallelStrings, totalUnits, installedKwh: totalUnits * b.capacityKwh };
}

/**
 * Picks the configuration with the fewest units (PRD §15.3); ties go to the
 * smallest installed capacity, then the lowest price. A single SKU is used for
 * the whole bank, so chemistry and capacity can never be mixed.
 */
export function selectBattery(
  requiredKwh: number,
  chemistry: BatteryChemistry,
  systemVoltage: number,
  batteries: BatterySku[],
): BatterySizing {
  const isLithium = chemistry === "lithium";
  const candidates = batteries.filter((b) =>
    isLithium
      ? b.chemistry === "lithium" && b.dcVoltage === systemVoltage
      : b.chemistry === chemistry && b.dcVoltage === LEAD_ACID_BLOCK_VOLTAGE && systemVoltage % LEAD_ACID_BLOCK_VOLTAGE === 0,
  );

  if (candidates.length === 0) {
    throw new EngineError(
      "NO_SKU_AVAILABLE",
      `No ${chemistry} battery compatible with a ${systemVoltage}V system is currently in stock.`,
      "batteryChemistry",
      { chemistry, systemVoltage },
    );
  }

  const options = candidates.map((b) =>
    isLithium ? lithiumOption(b, requiredKwh) : leadAcidOption(b, requiredKwh, systemVoltage),
  );
  options.sort(
    (a, b) =>
      a.totalUnits - b.totalUnits ||
      a.installedKwh - b.installedKwh ||
      a.totalUnits * a.battery.unitPriceNgn - b.totalUnits * b.battery.unitPriceNgn,
  );
  return { requiredKwh, ...options[0]! };
}
