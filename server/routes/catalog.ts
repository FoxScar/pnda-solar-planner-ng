import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { appliances, components, sunHours } from "../db/schema";
import type { AppEnv } from "../lib/context";
import { ok } from "../lib/http";
import { requireRole } from "../lib/middleware";
import { loadSettings } from "../lib/settings";
import { periodWindows } from "../../shared/settings";

export const catalogRoutes = new Hono<AppEnv>()
  /**
   * Public appliance catalogue. Wattage and surge data stay server-side (FR-003):
   * the client only needs ids, names and categories to build the wizard.
   */
  .get("/appliances", async (c) => {
    const rows = await c.var.db
      .select({ id: appliances.id, name: appliances.name, category: appliances.category })
      .from(appliances)
      .where(eq(appliances.isActive, true))
      .orderBy(asc(appliances.category), asc(appliances.name));
    return ok(c, rows);
  })

  .get("/sun-hours", async (c) => {
    const rows = await c.var.db
      .select({ state: sunHours.state, region: sunHours.region })
      .from(sunHours)
      .orderBy(asc(sunHours.state));
    return ok(c, rows);
  })

  /** Day/night windows the wizard uses to label and limit appliance hours (schematics §1). */
  .get("/config", async (c) => {
    const { engine } = await loadSettings(c.var.db);
    return ok(c, { nightStart: engine.nightStart, nightEnd: engine.nightEnd, ...periodWindows(engine) });
  })

  /** Active inventory for installers and admins (PRD §24.1). */
  .get("/components", requireRole("installer"), async (c) => {
    const rows = await c.var.db
      .select()
      .from(components)
      .where(and(eq(components.isActive, true)))
      .orderBy(asc(components.type), asc(components.kva), asc(components.capacityKwh), asc(components.wattsPeak));
    return ok(c, rows);
  });
