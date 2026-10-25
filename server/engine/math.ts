/** Ceiling that ignores floating-point noise (e.g. 7.000000000001 → 7). */
export function ceilSafe(x: number): number {
  return Math.ceil(x - 1e-9);
}

/** Rounds for presentation/audit; never used before a ceiling. */
export function round(x: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}
