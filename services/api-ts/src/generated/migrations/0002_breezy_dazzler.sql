CREATE TYPE "public"."affiliation_status" AS ENUM('active', 'transferred', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('requested', 'pendingSourceApproval', 'pendingTargetApproval', 'approved', 'denied', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."directory_visibility" AS ENUM('public', 'memberOnly', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."dues_config_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."dues_invoice_status" AS ENUM('generated', 'sent', 'paid', 'overdue', 'cancelled', 'writtenOff');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('submitted', 'underReview', 'approved', 'denied', 'waitlisted');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('pendingPayment', 'active', 'gracePeriod', 'lapsed', 'expired', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."tier_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TABLE "affiliation_transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"from_chapter_id" uuid NOT NULL,
	"to_chapter_id" uuid NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"requested_by" uuid NOT NULL,
	"approved_by_source" uuid,
	"approved_by_target" uuid,
	"status" "transfer_status" DEFAULT 'requested' NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chapter_affiliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"affiliated_at" timestamp NOT NULL,
	"transferred_from" uuid,
	"status" "affiliation_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "royalty_split" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"national_org_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"split_percent_national" real NOT NULL,
	"split_percent_chapter" real NOT NULL,
	"effective_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"display_name" varchar(150) NOT NULL,
	"title" varchar(100),
	"organization" varchar(150),
	"specialty" varchar(150),
	"location" varchar(150),
	"photo_url" varchar(2048),
	"bio" text,
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"website" varchar(2048),
	"social_links" jsonb,
	"visibility" "directory_visibility" DEFAULT 'hidden' NOT NULL,
	"published_at" timestamp,
	"last_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aging_bucket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"as_of_date" date NOT NULL,
	"current" bigint DEFAULT 0 NOT NULL,
	"thirty_day" bigint DEFAULT 0 NOT NULL,
	"sixty_day" bigint DEFAULT 0 NOT NULL,
	"ninety_day" bigint DEFAULT 0 NOT NULL,
	"over_ninety" bigint DEFAULT 0 NOT NULL,
	"total_outstanding" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dues_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"tier_id" varchar(255) NOT NULL,
	"annual_amount" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"grace_period_days" integer DEFAULT 30 NOT NULL,
	"fund_allocations" jsonb NOT NULL,
	"effective_date" date NOT NULL,
	"status" "dues_config_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dues_invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" varchar(255) NOT NULL,
	"membership_id" varchar(255) NOT NULL,
	"person_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_amount" bigint NOT NULL,
	"fund_allocations" jsonb NOT NULL,
	"status" "dues_invoice_status" DEFAULT 'generated' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"paid_at" timestamp,
	"payment_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "membership_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"application_date" date NOT NULL,
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"denial_reason" text
);
--> statement-breakpoint
CREATE TABLE "membership_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"org_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"applicable_tiers" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(30) NOT NULL,
	"description" text,
	"annual_fee" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"benefits" jsonb,
	"max_members" integer,
	"status" "tier_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"category_id" uuid,
	"member_number" varchar(50),
	"start_date" date NOT NULL,
	"dues_expiry_date" date NOT NULL,
	"grace_period_days" integer DEFAULT 30 NOT NULL,
	"status" "membership_status" DEFAULT 'pendingPayment' NOT NULL,
	"joined_at" timestamp NOT NULL,
	"terminated_at" timestamp,
	"termination_reason" varchar(500),
	"note" text
);
--> statement-breakpoint
ALTER TABLE "membership_application" ADD CONSTRAINT "membership_application_tier_id_membership_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."membership_tier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_tier_id_membership_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."membership_tier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_category_id_membership_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."membership_category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliation_transfer_tenant_status_idx" ON "affiliation_transfer" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "chapter_affiliation_tenant_person_idx" ON "chapter_affiliation" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "chapter_affiliation_tenant_chapter_idx" ON "chapter_affiliation" USING btree ("tenant_id","chapter_id");--> statement-breakpoint
CREATE INDEX "royalty_split_tenant_chapter_idx" ON "royalty_split" USING btree ("tenant_id","chapter_id");--> statement-breakpoint
CREATE INDEX "royalty_split_tenant_membership_idx" ON "royalty_split" USING btree ("tenant_id","membership_id");--> statement-breakpoint
CREATE INDEX "directory_profile_tenant_person_idx" ON "directory_profile" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "directory_profile_tenant_visibility_idx" ON "directory_profile" USING btree ("tenant_id","visibility");--> statement-breakpoint
CREATE INDEX "aging_bucket_tenant_org_idx" ON "aging_bucket" USING btree ("tenant_id","organization_id");--> statement-breakpoint
CREATE INDEX "dues_config_tenant_org_idx" ON "dues_config" USING btree ("tenant_id","organization_id");--> statement-breakpoint
CREATE INDEX "dues_invoice_tenant_org_status_idx" ON "dues_invoice" USING btree ("tenant_id","organization_id","status");--> statement-breakpoint
CREATE INDEX "dues_invoice_tenant_membership_idx" ON "dues_invoice" USING btree ("tenant_id","membership_id");--> statement-breakpoint
CREATE INDEX "membership_app_tenant_org_status_idx" ON "membership_application" USING btree ("tenant_id","org_id","status");--> statement-breakpoint
CREATE INDEX "membership_category_tenant_idx" ON "membership_category" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "membership_tier_tenant_idx" ON "membership_tier" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "membership_tier_tenant_code_idx" ON "membership_tier" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "membership_tenant_org_idx" ON "membership" USING btree ("tenant_id","org_id");--> statement-breakpoint
CREATE INDEX "membership_tenant_person_idx" ON "membership" USING btree ("tenant_id","person_id");--> statement-breakpoint
CREATE INDEX "membership_tenant_status_idx" ON "membership" USING btree ("tenant_id","status");