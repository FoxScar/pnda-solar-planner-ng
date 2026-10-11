import type { Db } from "../client";
import { appliances, components, sunHours } from "../schema";
import { APPLIANCES, BATTERIES, INVERTERS, PANELS, SUN_HOURS } from "./data";

/**
 * Idempotent: inserts missing rows only, so re-running never overwrites
 * prices or sun hours an admin has edited.
 */
export async function seed(db: Db) {
  await db.transaction(async (tx) => {
    await tx.insert(sunHours).values(SUN_HOURS).onConflictDoNothing();
    await tx.insert(components).values([...INVERTERS, ...BATTERIES, ...PANELS]).onConflictDoNothing();
    await tx.insert(appliances).values(APPLIANCES).onConflictDoNothing();
  });
  return {
    sunHours: SUN_HOURS.length,
    components: INVERTERS.length + BATTERIES.length + PANELS.length,
    appliances: APPLIANCES.length,
  };
}
