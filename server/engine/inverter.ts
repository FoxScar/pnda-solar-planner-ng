import type { EngineSettings } from "../../shared/settings";
import { MAX_INVERTER_KVA } from "./constants";
import { EngineError } from "./errors";
import type { InverterSelection, InverterSku, LoadProfile } from "./types";

/** Product ratings, falling back to settings defaults where the record has none. */
export function inverterRatings(inv: InverterSku, settings: EngineSettings) {
  const continuousW = inv.continuousW ?? inv.kva * 1000 * settings.powerFactor;
  const surgeW = inv.surgeW ?? continuousW * settings.defaultInverterSurgeMultiplier;
  return {
    continuousW,
    surgeW,
    efficiency: inv.efficiency ?? settings.defaultInverterEfficiency,
    specsAssumed: inv.continuousW === null || inv.surgeW === null,
  };
}

/**
 * Schematics §2: required VA = peak watts ÷ power factor. Returns every in-stock
 * inverter that meets the VA, continuous real-power and surge requirements,
 * smallest first. The caller picks the first one that also yields a valid
 * battery bank and PV array.
 */
export function qualifyingInverters(load: LoadProfile, inverters: InverterSku[], settings: EngineSettings): InverterSelection[] {
  const requiredVa = load.peakW / settings.powerFactor;

  if (requiredVa > MAX_INVERTER_KVA * 1000) {
    throw new EngineError(
      "OVERSIZE_REQUIRED",
      `This load needs about ${(requiredVa / 1000).toFixed(1)}kVA, which is above the ${MAX_INVERTER_KVA}kVA single-inverter limit. ` +
        "It needs a multi-inverter (phase-split) design by an engineer, or fewer appliances running at the same time.",
      "appliances",
      { requiredVa, maxKva: MAX_INVERTER_KVA },
    );
  }

  const qualifying = [...inverters]
    .sort((a, b) => a.kva - b.kva || a.unitPriceNgn - b.unitPriceNgn)
    .map((inverter) => ({ inverter, ...inverterRatings(inverter, settings) }))
    .filter((c) => c.inverter.kva * 1000 >= requiredVa && c.continuousW >= load.peakW && c.surgeW >= load.surgeRequirementW)
    .map((c) => ({ ...c, systemVoltage: c.inverter.dcVoltage, requiredVa }));

  if (qualifying.length === 0) {
    throw new EngineError(
      "NO_SKU_AVAILABLE",
      `No inverter in stock can supply ${(requiredVa / 1000).toFixed(1)}kVA with a ${(load.surgeRequirementW / 1000).toFixed(1)}kW start-up surge.`,
      "inverter",
      { requiredVa, peakW: load.peakW, surgeRequirementW: load.surgeRequirementW },
    );
  }
  return qualifying;
}
