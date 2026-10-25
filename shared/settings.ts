import { z } from "zod";

/**
 * Engineering and pricing parameters (Developer Calculation Schematics, 2026).
 * Defaults are the schematic's illustrative values; admins can change them, and
 * product-specific values on a component always take precedence.
 */

const fraction = z.number().gt(0).lte(1);
const chemistryDefaults = z.object({
  depthOfDischarge: fraction,
  dischargeEfficiency: fraction,
});

export const engineSettingsSchema = z.object({
  /** Approximate VA = peak watts ÷ power factor (§2). */
  powerFactor: fraction,
  /** Battery safety margin applied to night energy (§3), e.g. 0.30 = 30%. */
  safetyMargin: z.number().min(0).max(2),
  /** Used when an inverter has no efficiency on record (§3). */
  defaultInverterEfficiency: fraction,
  /** Inverter surge = continuous × this, when the product has no surge rating. */
  defaultInverterSurgeMultiplier: z.number().min(1).max(5),
  /** Used when a battery has no DoD / discharge efficiency on record (§3). */
  chemistryDefaults: z.object({ lithium: chemistryDefaults, gel: chemistryDefaults, tubular: chemistryDefaults }),
  /** Which state sun-hour figure sizing uses. */
  sunHoursBasis: z.enum(["wet", "annual", "dry"]),
  /** Night window (§1): defaults to 17:00–06:00, 13 hours. */
  nightStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  nightEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /**
   * §5/§7: a quote is only eligible once the array is checked against the
   * inverter's PV input limits. When true, inverters without PV limits on
   * record cannot produce a quote.
   */
  requireVerifiedPvLimits: z.boolean(),
});
export type EngineSettings = z.infer<typeof engineSettingsSchema>;

export const pricingSettingsSchema = z.object({
  /** §6: installation fee = subtotal × rate. */
  installationRate: z.number().min(0).max(1),
  /** VAT applied to the quote total (Nigeria 7.5%). Set 0 to omit. */
  vatRate: z.number().min(0).max(0.5),
});
export type PricingSettings = z.infer<typeof pricingSettingsSchema>;

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  powerFactor: 0.8,
  safetyMargin: 0.3,
  defaultInverterEfficiency: 0.9,
  defaultInverterSurgeMultiplier: 2,
  chemistryDefaults: {
    lithium: { depthOfDischarge: 0.8, dischargeEfficiency: 0.95 },
    gel: { depthOfDischarge: 0.5, dischargeEfficiency: 0.85 },
    tubular: { depthOfDischarge: 0.5, dischargeEfficiency: 0.85 },
  },
  sunHoursBasis: "wet",
  nightStart: "17:00",
  nightEnd: "06:00",
  requireVerifiedPvLimits: false,
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  installationRate: 0.15,
  vatRate: 0.075,
};

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

/** Length of the night and day windows in hours, from the configured night start/end. */
export function periodWindows(s: Pick<EngineSettings, "nightStart" | "nightEnd">) {
  const night = (minutes(s.nightEnd) - minutes(s.nightStart) + 24 * 60) % (24 * 60) || 24 * 60;
  return { nightHours: night / 60, dayHours: 24 - night / 60 };
}
