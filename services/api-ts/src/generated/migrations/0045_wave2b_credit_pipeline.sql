-- Wave 2b-S1
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."credit_source_type" AS ENUM('event_checkin','training_completion','course_completion','manual_award'); EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."credit_status" AS ENUM('active','voided','disputed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN "source_type" "credit_source_type";
--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN "source_id" uuid;
--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN "cpd_activity_type" "cpd_activity_type";
--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN "attestation" jsonb;
--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN "status" "credit_status" DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN "voided_reason" varchar(500);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credit_source" ON "credit_entry" USING btree ("source_type","source_id");
--> statement-breakpoint
ALTER TABLE "credit_entry" ADD CONSTRAINT "uq_credit_source_person" UNIQUE("source_type","source_id","person_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_cpd_config" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL,"updated_at" timestamp DEFAULT now() NOT NULL,"version" integer DEFAULT 1 NOT NULL,"created_by" uuid,"updated_by" uuid,"organization_id" uuid NOT NULL,"required_credits" integer DEFAULT 60 NOT NULL,"cycle_length_years" integer DEFAULT 3 NOT NULL,"sdl_cap_percent" integer DEFAULT 40 NOT NULL,"activity_type_minimums" jsonb,"cycle_start_month" integer DEFAULT 1 NOT NULL);
--> statement-breakpoint
ALTER TABLE "org_cpd_config" ADD CONSTRAINT "uq_org_cpd_config_org" UNIQUE("organization_id");
