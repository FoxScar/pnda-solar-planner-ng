CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('PRICE_UPDATE', 'AVAILABILITY_TOGGLE', 'COMPONENT_CREATE', 'COMPONENT_UPDATE', 'APPLIANCE_CREATE', 'APPLIANCE_UPDATE', 'SUN_HOUR_UPDATE', 'ROLE_CHANGE', 'ENGINEER_OVERRIDE');--> statement-breakpoint
CREATE TYPE "public"."battery_chemistry" AS ENUM('lithium', 'gel', 'tubular');--> statement-breakpoint
CREATE TYPE "public"."component_type" AS ENUM('inverter', 'battery', 'panel');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'generated', 'viewed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('consumer', 'installer', 'engineer', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"user_id" text,
	"ad_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_url" text NOT NULL,
	"duration_seconds" integer DEFAULT 30 NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appliances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"watts" integer NOT NULL,
	"surge_factor" double precision DEFAULT 1 NOT NULL,
	"is_air_conditioner" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appliances_name_unique" UNIQUE("name"),
	CONSTRAINT "appliances_watts_positive" CHECK ("appliances"."watts" > 0),
	CONSTRAINT "appliances_surge_factor_min" CHECK ("appliances"."surge_factor" >= 1)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"action" "audit_action" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"type" "component_type" NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"kva" double precision,
	"dc_voltage" integer,
	"chemistry" "battery_chemistry",
	"capacity_kwh" double precision,
	"capacity_ah" double precision,
	"watts_peak" integer,
	"unit_price_ngn" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "components_sku_unique" UNIQUE("sku"),
	CONSTRAINT "components_price_positive" CHECK ("components"."unit_price_ngn" > 0),
	CONSTRAINT "components_inverter_fields" CHECK ("components"."type" <> 'inverter' OR ("components"."kva" > 0 AND "components"."dc_voltage" IN (24, 48))),
	CONSTRAINT "components_battery_fields" CHECK ("components"."type" <> 'battery' OR ("components"."chemistry" IS NOT NULL AND "components"."capacity_kwh" > 0 AND "components"."dc_voltage" IN (12, 24, 48))),
	CONSTRAINT "components_panel_fields" CHECK ("components"."type" <> 'panel' OR "components"."watts_peak" > 0)
);
--> statement-breakpoint
CREATE TABLE "installer_inventory" (
	"installer_id" text NOT NULL,
	"component_id" uuid NOT NULL,
	"price_override_ngn" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installer_inventory_installer_id_component_id_pk" PRIMARY KEY("installer_id","component_id"),
	CONSTRAINT "installer_inventory_price_positive" CHECK ("installer_inventory"."price_override_ngn" IS NULL OR "installer_inventory"."price_override_ngn" > 0)
);
--> statement-breakpoint
CREATE TABLE "installer_margins" (
	"installer_id" text PRIMARY KEY NOT NULL,
	"margin_pct" double precision DEFAULT 0 NOT NULL,
	"labour_flat_fee_ngn" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installer_margins_pct_range" CHECK ("installer_margins"."margin_pct" >= 0 AND "installer_margins"."margin_pct" <= 200),
	CONSTRAINT "installer_margins_labour_nonneg" CHECK ("installer_margins"."labour_flat_fee_ngn" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quote_calc_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid,
	"user_id" text,
	"inputs" jsonb NOT NULL,
	"step_results" jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"user_id" text,
	"installer_id" text,
	"client_name" text,
	"state" text NOT NULL,
	"status" "quote_status" DEFAULT 'generated' NOT NULL,
	"flags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"share_token" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"bom" jsonb NOT NULL,
	"pricing" jsonb NOT NULL,
	"total_cost_ngn" bigint NOT NULL,
	"engine_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "quotes_reference_unique" UNIQUE("reference"),
	CONSTRAINT "quotes_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sun_hours" (
	"state" text PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"annual_avg" double precision NOT NULL,
	"wet_season" double precision NOT NULL,
	"dry_season" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sun_hours_range" CHECK ("sun_hours"."wet_season" > 0 AND "sun_hours"."wet_season" <= "sun_hours"."annual_avg" AND "sun_hours"."annual_avg" <= "sun_hours"."dry_season" AND "sun_hours"."dry_season" <= 12)
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "role" DEFAULT 'consumer' NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"company_name" text,
	"phone" text,
	"whatsapp_number" text,
	"installer_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installer_inventory" ADD CONSTRAINT "installer_inventory_installer_id_user_id_fk" FOREIGN KEY ("installer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installer_inventory" ADD CONSTRAINT "installer_inventory_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installer_margins" ADD CONSTRAINT "installer_margins_installer_id_user_id_fk" FOREIGN KEY ("installer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_calc_audit" ADD CONSTRAINT "quote_calc_audit_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_installer_id_user_id_fk" FOREIGN KEY ("installer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ad_events_quote_idx" ON "ad_events" USING btree ("quote_id","started_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "components_type_active_idx" ON "components" USING btree ("type","is_active");--> statement-breakpoint
CREATE INDEX "quote_calc_audit_quote_idx" ON "quote_calc_audit" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_user_idx" ON "quotes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "quotes_installer_idx" ON "quotes" USING btree ("installer_id","created_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");