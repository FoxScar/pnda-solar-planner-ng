CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_calc_audit" DROP CONSTRAINT "quote_calc_audit_quote_id_quotes_id_fk";
--> statement-breakpoint
DROP INDEX "quote_calc_audit_quote_idx";--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "max_pv_input_w" integer;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "calc_audit_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_calc_audit_id_quote_calc_audit_id_fk" FOREIGN KEY ("calc_audit_id") REFERENCES "public"."quote_calc_audit"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_calc_audit_user_idx" ON "quote_calc_audit" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "quote_calc_audit" DROP COLUMN "quote_id";