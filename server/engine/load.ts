import type { LoadItem, LoadProfile } from "./types";

function periodPeak(loads: LoadItem[], isActive: (l: LoadItem) => boolean) {
  const active = loads.filter(isActive);
  const runningW = active.reduce((sum, l) => sum + l.watts * l.quantity, 0);
  // Only one motor is assumed to start at a time: add the largest single-unit surge delta.
  const maxSurgeDeltaW = active.reduce((max, l) => Math.max(max, (l.surgeFactor - 1) * l.watts), 0);
  return { runningKw: runningW / 1000, surgeKw: (runningW + maxSurgeDeltaW) / 1000 };
}

/**
 * Day and night energy and peaks as separate variables (FR-011).
 * Every appliance active in a period is assumed able to run simultaneously.
 */
export function computeLoadProfile(loads: LoadItem[]): LoadProfile {
  const dayEnergyWh = loads.reduce((sum, l) => sum + l.watts * l.quantity * l.dayHours, 0);
  const nightEnergyWh = loads.reduce((sum, l) => sum + l.watts * l.quantity * l.nightHours, 0);
  const day = periodPeak(loads, (l) => l.dayHours > 0);
  const night = periodPeak(loads, (l) => l.nightHours > 0);
  return {
    dayEnergyKwh: dayEnergyWh / 1000,
    nightEnergyKwh: nightEnergyWh / 1000,
    dayRunningPeakKw: day.runningKw,
    nightRunningPeakKw: night.runningKw,
    daySurgePeakKw: day.surgeKw,
    nightSurgePeakKw: night.surgeKw,
    designPeakKw: Math.max(day.surgeKw, night.surgeKw),
    hasAirConditioner: loads.some((l) => l.isAirConditioner),
  };
}
