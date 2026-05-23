--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."certificate_status" AS ENUM('issued','revoked'); EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "template_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "signing_officer_id" uuid;
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "credit_hours" integer;
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "cpd_activity_type" "cpd_activity_type";
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "status" "certificate_status" DEFAULT 'issued';
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "pdf_url" varchar(500);
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "revoked_at" timestamp;
--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN "revoked_reason" varchar(500);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_status_idx" ON "certificate" USING btree ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_certificate_seq" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"created_at" timestamp DEFAULT now() NOT NULL,"updated_at" timestamp DEFAULT now() NOT NULL,"version" integer DEFAULT 1 NOT NULL,"created_by" uuid,"updated_by" uuid,"organization_id" uuid NOT NULL,"year" integer NOT NULL,"last_seq" integer DEFAULT 0 NOT NULL,"org_code" varchar(20) NOT NULL);
--> statement-breakpoint
ALTER TABLE "org_certificate_seq" ADD CONSTRAINT "org_cert_seq_org_year_unique" UNIQUE("organization_id","year");
