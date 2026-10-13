import { inArray } from "drizzle-orm";
import {
  DEFAULT_ENGINE_SETTINGS,
  DEFAULT_PRICING_SETTINGS,
  engineSettingsSchema,
  pricingSettingsSchema,
  type EngineSettings,
  type PricingSettings,
} from "../../shared/settings";
import type { Db } from "../db/client";
import { settings } from "../db/schema";

export interface AppSettings {
  engine: EngineSettings;
  pricing: PricingSettings;
}

/**
 * Stored settings merged over the defaults. A stored value that no longer
 * validates (e.g. after a schema change) falls back to the defaults rather than
 * breaking every calculation.
 */
export async function loadSettings(db: Db): Promise<AppSettings> {
  const rows = await db.select().from(settings).where(inArray(settings.key, ["engine", "pricing"]));
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value as Record<string, unknown>]));
  const engine = engineSettingsSchema.safeParse({ ...DEFAULT_ENGINE_SETTINGS, ...stored.engine });
  const pricing = pricingSettingsSchema.safeParse({ ...DEFAULT_PRICING_SETTINGS, ...stored.pricing });
  if (!engine.success) console.error("[settings] stored engine settings invalid; using defaults", engine.error.issues);
  if (!pricing.success) console.error("[settings] stored pricing settings invalid; using defaults", pricing.error.issues);
  return {
    engine: engine.success ? engine.data : DEFAULT_ENGINE_SETTINGS,
    pricing: pricing.success ? pricing.data : DEFAULT_PRICING_SETTINGS,
  };
}
