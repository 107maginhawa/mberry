DO $$ BEGIN
CREATE TYPE "public"."credit_cpd_category" AS ENUM('General', 'Major', 'Self-Directed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."credit_verification_status" AS ENUM('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
CREATE TYPE "public"."accredited_provider_status" AS ENUM('active', 'suspended', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accredited_provider" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"name" varchar(300) NOT NULL,
	"accreditation_number" varchar(100) NOT NULL,
	"status" "accredited_provider_status" DEFAULT 'active' NOT NULL,
	"expiry_date" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "credit_entry" ADD COLUMN "category" "credit_cpd_category";
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "credit_entry" ADD COLUMN "approval_code" varchar(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "credit_entry" ADD COLUMN "verification_status" "credit_verification_status" DEFAULT 'pending' NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "training" ADD COLUMN "prc_accreditation_number" varchar(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "training" ADD COLUMN "accredited_provider_id" uuid;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accredited_provider_org" ON "accredited_provider" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accredited_provider_status" ON "accredited_provider" USING btree ("status");