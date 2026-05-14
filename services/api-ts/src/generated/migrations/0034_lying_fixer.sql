CREATE TYPE "public"."credit_cpd_category" AS ENUM('General', 'Major', 'Self-Directed');--> statement-breakpoint
CREATE TYPE "public"."credit_verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."accredited_provider_status" AS ENUM('active', 'suspended', 'expired');--> statement-breakpoint
CREATE TABLE "accredited_provider" (
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
ALTER TABLE "credit_entry" ADD COLUMN "category" "credit_cpd_category";--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN "approval_code" varchar(100);--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN "verification_status" "credit_verification_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "training" ADD COLUMN "prc_accreditation_number" varchar(100);--> statement-breakpoint
ALTER TABLE "training" ADD COLUMN "accredited_provider_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_accredited_provider_org" ON "accredited_provider" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_accredited_provider_status" ON "accredited_provider" USING btree ("status");