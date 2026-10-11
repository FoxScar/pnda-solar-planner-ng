import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  AUDIT_ACTIONS,
  BATTERY_CHEMISTRIES,
  COMPONENT_TYPES,
  QUOTE_STATUSES,
  ROLES,
} from "../../shared/domain";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ROLES);
export const componentTypeEnum = pgEnum("component_type", COMPONENT_TYPES);
export const batteryChemistryEnum = pgEnum("battery_chemistry", BATTERY_CHEMISTRIES);
export const quoteStatusEnum = pgEnum("quote_status", QUOTE_STATUSES);
export const auditActionEnum = pgEnum("audit_action", AUDIT_ACTIONS);
export const accountStatusEnum = pgEnum("account_status", ["active", "suspended"]);

// ---------------------------------------------------------------------------
// Better Auth tables (names and columns must match Better Auth's core schema)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Application tables (PRD §21)
// ---------------------------------------------------------------------------

/** Extended profile and role for every auth user. Created on sign-up. */
export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("consumer"),
  status: accountStatusEnum("status").notNull().default("active"),
  companyName: text("company_name"),
  phone: text("phone"),
  whatsappNumber: text("whatsapp_number"),
  installerVerified: boolean("installer_verified").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Master appliance catalogue. Wattage is internal: never shown to end users (FR-003). */
export const appliances = pgTable(
  "appliances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    category: text("category").notNull(),
    watts: integer("watts").notNull(),
    /** Start-up multiple of running watts (AC 3.0, pump 2.5, compressor 2.0, else 1.0). */
    surgeFactor: doublePrecision("surge_factor").notNull().default(1),
    /** Air conditioners force lithium chemistry (FR-019). */
    isAirConditioner: boolean("is_air_conditioner").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("appliances_watts_positive", sql`${t.watts} > 0`),
    check("appliances_surge_factor_min", sql`${t.surgeFactor} >= 1`),
  ],
);

/** Inverter / battery / panel inventory (single table keyed by type). */
export const components = pgTable(
  "components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull().unique(),
    type: componentTypeEnum("type").notNull(),
    brand: text("brand").notNull(),
    model: text("model").notNull(),
    /** Inverters only. */
    kva: doublePrecision("kva"),
    /** Inverter DC bus voltage, or battery nominal voltage. */
    dcVoltage: integer("dc_voltage"),
    /** Batteries only. */
    chemistry: batteryChemistryEnum("chemistry"),
    capacityKwh: doublePrecision("capacity_kwh"),
    capacityAh: doublePrecision("capacity_ah"),
    /** Panels only. */
    wattsPeak: integer("watts_peak"),
    unitPriceNgn: bigint("unit_price_ngn", { mode: "number" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("components_type_active_idx").on(t.type, t.isActive),
    check("components_price_positive", sql`${t.unitPriceNgn} > 0`),
    check(
      "components_inverter_fields",
      sql`${t.type} <> 'inverter' OR (${t.kva} > 0 AND ${t.dcVoltage} IN (24, 48))`,
    ),
    check(
      "components_battery_fields",
      sql`${t.type} <> 'battery' OR (${t.chemistry} IS NOT NULL AND ${t.capacityKwh} > 0 AND ${t.dcVoltage} IN (12, 24, 48))`,
    ),
    check("components_panel_fields", sql`${t.type} <> 'panel' OR ${t.wattsPeak} > 0`),
  ],
);

/** Peak sun hours per state. Sizing uses the wet-season value (agreed engineering rule). */
export const sunHours = pgTable(
  "sun_hours",
  {
    state: text("state").primaryKey(),
    region: text("region").notNull(),
    annualAvg: doublePrecision("annual_avg").notNull(),
    wetSeason: doublePrecision("wet_season").notNull(),
    drySeason: doublePrecision("dry_season").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "sun_hours_range",
      sql`${t.wetSeason} > 0 AND ${t.wetSeason} <= ${t.annualAvg} AND ${t.annualAvg} <= ${t.drySeason} AND ${t.drySeason} <= 12`,
    ),
  ],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    installerId: text("installer_id").references(() => user.id, { onDelete: "set null" }),
    clientName: text("client_name"),
    state: text("state").notNull(),
    status: quoteStatusEnum("status").notNull().default("generated"),
    flags: text("flags").array().notNull().default(sql`ARRAY[]::text[]`),
    /** Unguessable token for the public 30-day share link (FR-034). */
    shareToken: text("share_token").notNull().unique(),
    inputs: jsonb("inputs").notNull(),
    result: jsonb("result").notNull(),
    /** Bill of materials with the unit prices captured at generation time. */
    bom: jsonb("bom").notNull(),
    pricing: jsonb("pricing").notNull(),
    totalCostNgn: bigint("total_cost_ngn", { mode: "number" }).notNull(),
    engineVersion: text("engine_version").notNull(),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("quotes_user_idx").on(t.userId, t.createdAt),
    index("quotes_installer_idx").on(t.installerId, t.createdAt),
  ],
);

/** Immutable calculation trace (write-once, enforced by trigger in a custom migration). */
export const quoteCalcAudit = pgTable(
  "quote_calc_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "restrict" }),
    userId: text("user_id"),
    inputs: jsonb("inputs").notNull(),
    stepResults: jsonb("step_results").notNull(),
    engineVersion: text("engine_version").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quote_calc_audit_quote_idx").on(t.quoteId)],
);

export const installerInventory = pgTable(
  "installer_inventory",
  {
    installerId: text("installer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    priceOverrideNgn: bigint("price_override_ngn", { mode: "number" }),
    isActive: boolean("is_active").notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.installerId, t.componentId] }),
    check(
      "installer_inventory_price_positive",
      sql`${t.priceOverrideNgn} IS NULL OR ${t.priceOverrideNgn} > 0`,
    ),
  ],
);

export const installerMargins = pgTable(
  "installer_margins",
  {
    installerId: text("installer_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    marginPct: doublePrecision("margin_pct").notNull().default(0),
    labourFlatFeeNgn: bigint("labour_flat_fee_ngn", { mode: "number" }).notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("installer_margins_pct_range", sql`${t.marginPct} >= 0 AND ${t.marginPct} <= 200`),
    check("installer_margins_labour_nonneg", sql`${t.labourFlatFeeNgn} >= 0`),
  ],
);

/** Platform-wide admin/engineer actions (write-once). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").notNull(),
    action: auditActionEnum("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entityType, t.entityId, t.createdAt)],
);

export const ads = pgTable("ads", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerUrl: text("provider_url").notNull(),
  durationSeconds: integer("duration_seconds").notNull().default(30),
  weight: integer("weight").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

/** Ad-gate start/complete events, validated server-side (PRD §31.2). */
export const adEvents = pgTable(
  "ad_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    adId: uuid("ad_id").references(() => ads.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("ad_events_quote_idx").on(t.quoteId, t.startedAt)],
);
