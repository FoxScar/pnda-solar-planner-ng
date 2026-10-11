import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { BATTERY_CHEMISTRIES, ROLES, type AuditAction } from "../../shared/domain";
import type { Db } from "../db/client";
import { appliances, auditLog, components, sunHours, user, userProfiles } from "../db/schema";
import type { AppEnv } from "../lib/context";
import { ApiError, ok } from "../lib/http";
import { currentUser, requireRole } from "../lib/middleware";
import { validate } from "../lib/validate";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function writeAudit(
  tx: Tx,
  entry: {
    actorId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    before: unknown;
    after: unknown;
    requestId: string;
  },
) {
  await tx.insert(auditLog).values(entry);
}

const price = z.number().int().positive("Price must be greater than ₦0");
const uuidParam = z.object({ id: z.string().uuid() });

const componentBase = {
  sku: z.string().trim().min(2).max(40),
  brand: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(120),
  unitPriceNgn: price,
  isActive: z.boolean().default(true),
};

const componentCreate = z.discriminatedUnion("type", [
  z.object({
    ...componentBase,
    type: z.literal("inverter"),
    kva: z.number().positive().max(12, "Single inverters above 12kVA are not supported"),
    dcVoltage: z.union([z.literal(24), z.literal(48)]),
  }),
  z.object({
    ...componentBase,
    type: z.literal("battery"),
    chemistry: z.enum(BATTERY_CHEMISTRIES),
    dcVoltage: z.union([z.literal(12), z.literal(24), z.literal(48)]),
    capacityKwh: z.number().positive(),
    capacityAh: z.number().positive().nullable().optional(),
  }),
  z.object({
    ...componentBase,
    type: z.literal("panel"),
    wattsPeak: z.number().int().positive(),
  }),
]);

const componentPatch = z
  .object({
    brand: componentBase.brand,
    model: componentBase.model,
    unitPriceNgn: price,
    isActive: z.boolean(),
    kva: z.number().positive().max(12),
    dcVoltage: z.union([z.literal(12), z.literal(24), z.literal(48)]),
    chemistry: z.enum(BATTERY_CHEMISTRIES),
    capacityKwh: z.number().positive(),
    capacityAh: z.number().positive().nullable(),
    wattsPeak: z.number().int().positive(),
  })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, "Nothing to update");

function componentAuditAction(patch: Record<string, unknown>): AuditAction {
  const keys = Object.keys(patch);
  if (keys.length === 1 && keys[0] === "unitPriceNgn") return "PRICE_UPDATE";
  if (keys.length === 1 && keys[0] === "isActive") return "AVAILABILITY_TOGGLE";
  return "COMPONENT_UPDATE";
}

const applianceFields = {
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(40),
  watts: z.number().int().positive("Wattage must be greater than 0"),
  surgeFactor: z.number().min(1).max(6),
  isAirConditioner: z.boolean(),
  isActive: z.boolean(),
};
const applianceCreate = z.object({
  ...applianceFields,
  surgeFactor: applianceFields.surgeFactor.default(1),
  isAirConditioner: applianceFields.isAirConditioner.default(false),
  isActive: applianceFields.isActive.default(true),
});
const appliancePatch = z
  .object(applianceFields)
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, "Nothing to update");

const sunHoursPatch = z
  .object({
    annualAvg: z.number().positive().max(12),
    wetSeason: z.number().positive().max(12),
    drySeason: z.number().positive().max(12),
  })
  .refine((v) => v.wetSeason <= v.annualAvg && v.annualAvg <= v.drySeason, {
    message: "Expected wet season ≤ annual average ≤ dry season",
    path: ["annualAvg"],
  });

export const adminRoutes = new Hono<AppEnv>()
  .use(requireRole("admin"))

  // ---- Components ---------------------------------------------------------
  .get("/components", validate("query", z.object({ type: z.enum(["inverter", "battery", "panel"]).optional() })), async (c) => {
    const { type } = c.req.valid("query");
    const rows = await c.var.db
      .select()
      .from(components)
      .where(type ? eq(components.type, type) : undefined)
      .orderBy(asc(components.type), asc(components.kva), asc(components.capacityKwh), asc(components.wattsPeak));
    return ok(c, rows);
  })
  .post("/components", validate("json", componentCreate), async (c) => {
    const actor = currentUser(c);
    const input = c.req.valid("json");
    const created = await c.var.db.transaction(async (tx) => {
      const [row] = await tx.insert(components).values(input).returning();
      if (!row) throw new ApiError(500, "INTERNAL_ERROR", "Component was not created.");
      await writeAudit(tx, {
        actorId: actor.id,
        action: "COMPONENT_CREATE",
        entityType: "component",
        entityId: row.id,
        before: null,
        after: row,
        requestId: c.var.requestId,
      });
      return row;
    });
    return ok(c, created, 201);
  })
  .patch("/components/:id", validate("param", uuidParam), validate("json", componentPatch), async (c) => {
    const actor = currentUser(c);
    const { id } = c.req.valid("param");
    const patch = c.req.valid("json");
    const updated = await c.var.db.transaction(async (tx) => {
      const [before] = await tx.select().from(components).where(eq(components.id, id)).for("update");
      if (!before) throw new ApiError(404, "NOT_FOUND", "Component not found.");
      const [after] = await tx.update(components).set(patch).where(eq(components.id, id)).returning();
      await writeAudit(tx, {
        actorId: actor.id,
        action: componentAuditAction(patch),
        entityType: "component",
        entityId: id,
        before,
        after,
        requestId: c.var.requestId,
      });
      return after;
    });
    return ok(c, updated);
  })

  // ---- Appliances ---------------------------------------------------------
  .get("/appliances", async (c) => {
    const rows = await c.var.db.select().from(appliances).orderBy(asc(appliances.category), asc(appliances.name));
    return ok(c, rows);
  })
  .post("/appliances", validate("json", applianceCreate), async (c) => {
    const actor = currentUser(c);
    const input = c.req.valid("json");
    const created = await c.var.db.transaction(async (tx) => {
      const [row] = await tx.insert(appliances).values(input).returning();
      if (!row) throw new ApiError(500, "INTERNAL_ERROR", "Appliance was not created.");
      await writeAudit(tx, {
        actorId: actor.id,
        action: "APPLIANCE_CREATE",
        entityType: "appliance",
        entityId: row.id,
        before: null,
        after: row,
        requestId: c.var.requestId,
      });
      return row;
    });
    return ok(c, created, 201);
  })
  .patch("/appliances/:id", validate("param", uuidParam), validate("json", appliancePatch), async (c) => {
    const actor = currentUser(c);
    const { id } = c.req.valid("param");
    const patch = c.req.valid("json");
    const updated = await c.var.db.transaction(async (tx) => {
      const [before] = await tx.select().from(appliances).where(eq(appliances.id, id)).for("update");
      if (!before) throw new ApiError(404, "NOT_FOUND", "Appliance not found.");
      const [after] = await tx.update(appliances).set(patch).where(eq(appliances.id, id)).returning();
      await writeAudit(tx, {
        actorId: actor.id,
        action: "APPLIANCE_UPDATE",
        entityType: "appliance",
        entityId: id,
        before,
        after,
        requestId: c.var.requestId,
      });
      return after;
    });
    return ok(c, updated);
  })

  // ---- Sun hours ----------------------------------------------------------
  .get("/sun-hours", async (c) => {
    const rows = await c.var.db.select().from(sunHours).orderBy(asc(sunHours.state));
    return ok(c, rows);
  })
  .patch("/sun-hours/:state", validate("json", sunHoursPatch), async (c) => {
    const actor = currentUser(c);
    const state = c.req.param("state");
    const patch = c.req.valid("json");
    const updated = await c.var.db.transaction(async (tx) => {
      const [before] = await tx.select().from(sunHours).where(eq(sunHours.state, state)).for("update");
      if (!before) throw new ApiError(404, "STATE_NOT_FOUND", `No sun-hour record for "${state}".`);
      // updatedAt is refreshed by $onUpdate (cache invalidation, PRD §21.2).
      const [after] = await tx.update(sunHours).set(patch).where(eq(sunHours.state, state)).returning();
      await writeAudit(tx, {
        actorId: actor.id,
        action: "SUN_HOUR_UPDATE",
        entityType: "sun_hours",
        entityId: state,
        before,
        after,
        requestId: c.var.requestId,
      });
      return after;
    });
    return ok(c, updated);
  })

  // ---- Users --------------------------------------------------------------
  .get("/users", async (c) => {
    const rows = await c.var.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        role: userProfiles.role,
        status: userProfiles.status,
        installerVerified: userProfiles.installerVerified,
        companyName: userProfiles.companyName,
      })
      .from(user)
      .leftJoin(userProfiles, eq(userProfiles.userId, user.id))
      .orderBy(desc(user.createdAt));
    return ok(c, rows);
  })
  .patch(
    "/users/:id/role",
    validate("json", z.object({ role: z.enum(ROLES) }).strict()),
    async (c) => {
      const actor = currentUser(c);
      const targetId = c.req.param("id");
      const { role } = c.req.valid("json");
      if (targetId === actor.id) {
        throw new ApiError(403, "FORBIDDEN", "You cannot change your own role.");
      }
      const updated = await c.var.db.transaction(async (tx) => {
        const [before] = await tx.select().from(userProfiles).where(eq(userProfiles.userId, targetId)).for("update");
        if (!before) throw new ApiError(404, "NOT_FOUND", "User not found.");
        const [after] = await tx
          .update(userProfiles)
          .set({ role })
          .where(eq(userProfiles.userId, targetId))
          .returning();
        await writeAudit(tx, {
          actorId: actor.id,
          action: "ROLE_CHANGE",
          entityType: "user",
          entityId: targetId,
          before,
          after,
          requestId: c.var.requestId,
        });
        return after;
      });
      return ok(c, updated);
    },
  )

  // ---- Audit log ----------------------------------------------------------
  .get(
    "/audit-log",
    validate(
      "query",
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(50),
      }),
    ),
    async (c) => {
      const { page, pageSize } = c.req.valid("query");
      const rows = await c.var.db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      return ok(c, { items: rows, page, pageSize });
    },
  );
