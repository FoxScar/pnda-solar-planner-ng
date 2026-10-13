import type { LoadItem, LoadProfile } from "./types";

function period(loads: LoadItem[], isActive: (l: LoadItem) => boolean) {
  const active = loads.filter(isActive);
  // All-overlap assumption (schematics §1): every appliance used in the period may run together.
  const peakW = active.reduce((sum, l) => sum + l.watts * l.quantity, 0);
  // One motor is assumed to start at a time: add the largest single-unit start-up delta.
  const surgeDeltaW = active.reduce((max, l) => Math.max(max, (l.surgeFactor - 1) * l.watts), 0);
  return { peakW, surgeW: peakW + surgeDeltaW };
}

/** Schematics §1: energy per period, peak watts per period, and the start-up requirement. */
export function computeLoadProfile(loads: LoadItem[]): LoadProfile {
  const dayEnergyKwh = loads.reduce((sum, l) => sum + (l.watts * l.quantity * l.dayHours) / 1000, 0);
  const nightEnergyKwh = loads.reduce((sum, l) => sum + (l.watts * l.quantity * l.nightHours) / 1000, 0);
  const day = period(loads, (l) => l.dayHours > 0);
  const night = period(loads, (l) => l.nightHours > 0);
  return {
    dayEnergyKwh,
    nightEnergyKwh,
    totalEnergyKwh: dayEnergyKwh + nightEnergyKwh,
    dayPeakW: day.peakW,
    nightPeakW: night.peakW,
    peakW: Math.max(day.peakW, night.peakW),
    surgeRequirementW: Math.max(day.surgeW, night.surgeW),
    hasAirConditioner: loads.some((l) => l.isAirConditioner),
  };
}
