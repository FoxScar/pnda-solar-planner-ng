import { INVERTER_DERATING, MAX_INVERTER_KVA } from "./constants";
import { EngineError } from "./errors";
import type { InverterSelection, InverterSku } from "./types";

/**
 * Smallest active inverter whose derated rating covers the design peak and
 * whose charge controller (when its limit is known) accepts the PV array.
 */
export function selectInverter(
  designPeakKw: number,
  arrayWatts: number,
  inverters: InverterSku[],
): InverterSelection & { pvInputUnverified: boolean } {
  const requiredKvaForLoad = designPeakKw / INVERTER_DERATING;

  if (requiredKvaForLoad > MAX_INVERTER_KVA) {
    throw new EngineError(
      "OVERSIZE_REQUIRED",
      `This load needs about ${requiredKvaForLoad.toFixed(1)}kVA, which is above the ${MAX_INVERTER_KVA}kVA single-inverter limit. ` +
        "It needs a multi-inverter (phase-split) design by an engineer, or fewer appliances running at the same time.",
      "appliances",
      { requiredKva: requiredKvaForLoad, maxKva: MAX_INVERTER_KVA },
    );
  }

  const bigEnough = inverters
    .filter((inv) => inv.kva >= requiredKvaForLoad)
    .sort((a, b) => a.kva - b.kva || a.unitPriceNgn - b.unitPriceNgn);

  if (bigEnough.length === 0) {
    throw new EngineError(
      "NO_SKU_AVAILABLE",
      `No inverter of at least ${requiredKvaForLoad.toFixed(1)}kVA is currently in stock.`,
      "inverter",
      { requiredKva: requiredKvaForLoad },
    );
  }

  const inverter = bigEnough.find((inv) => inv.maxPvInputW === null || inv.maxPvInputW >= arrayWatts);
  if (!inverter) {
    throw new EngineError(
      "NO_SKU_AVAILABLE",
      `The ${(arrayWatts / 1000).toFixed(1)}kWp solar array needed is larger than any in-stock inverter can accept.`,
      "inverter",
      { arrayWatts, requiredKva: requiredKvaForLoad },
    );
  }

  return {
    requiredKvaForLoad,
    inverter,
    systemVoltage: inverter.dcVoltage,
    pvInputUnverified: inverter.maxPvInputW === null,
  };
}
