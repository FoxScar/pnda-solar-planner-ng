ALTER TYPE "public"."audit_action" ADD VALUE 'SETTINGS_UPDATE' BEFORE 'ENGINEER_OVERRIDE';--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "components" DROP CONSTRAINT "components_panel_fields";--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "efficiency" double precision;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "continuous_w" integer;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "surge_w" integer;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "max_pv_voc" double precision;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "max_pv_isc" double precision;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "mppt_count" integer;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "depth_of_discharge" double precision;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "discharge_efficiency" double precision;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "max_discharge_w" integer;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "performance_factor" double precision;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "voc" double precision;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "isc" double precision;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_fractions" CHECK (("components"."efficiency" IS NULL OR ("components"."efficiency" > 0 AND "components"."efficiency" <= 1)) AND ("components"."depth_of_discharge" IS NULL OR ("components"."depth_of_discharge" > 0 AND "components"."depth_of_discharge" <= 1)) AND ("components"."discharge_efficiency" IS NULL OR ("components"."discharge_efficiency" > 0 AND "components"."discharge_efficiency" <= 1)));--> statement-breakpoint
-- Backfill: existing panels get the schematics' illustrative performance factor (0.80).
UPDATE "components" SET "performance_factor" = 0.8 WHERE "type" = 'panel' AND "performance_factor" IS NULL;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_panel_fields" CHECK ("components"."type" <> 'panel' OR ("components"."watts_peak" > 0 AND "components"."performance_factor" > 0 AND "components"."performance_factor" <= 1));