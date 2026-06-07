DO $$ BEGIN CREATE TYPE "public"."ad_slot" AS ENUM('feed_banner', 'sidebar', 'email_footer', 'event_sponsor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'pending_review', 'active', 'paused', 'completed', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."creative_status" AS ENUM('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."credit_source_type" AS ENUM('event_checkin', 'training_completion', 'course_completion', 'manual_award'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."credit_status" AS ENUM('active', 'voided', 'disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."webhook_retry_status" AS ENUM('processing', 'completed', 'pending_retry', 'dead_letter'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."disciplinary_action_type" AS ENUM('warning', 'suspension', 'removal', 'probation'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."transition_checklist_status" AS ENUM('pending', 'completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."assessment_applies_to" AS ENUM('all', 'selected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."assessment_status" AS ENUM('draft', 'active', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."assessment_target_status" AS ENUM('pending', 'paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."committee_task_priority" AS ENUM('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."committee_task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."committee_member_role" AS ENUM('member', 'chairperson', 'vice_chairperson', 'secretary'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."committee_status" AS ENUM('active', 'completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."cpd_activity_type" AS ENUM('seminar', 'workshop', 'conference', 'webinar', 'hands_on', 'community', 'research', 'mentorship', 'self_directed', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."certificate_status" AS ENUM('issued', 'revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."feed_post_status" AS ENUM('published', 'draft', 'flagged', 'removed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."feed_post_type" AS ENUM('announcement', 'event_highlight', 'training_opportunity', 'achievement', 'clinical_update'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."feed_post_visibility" AS ENUM('org', 'network'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."survey_distribution" AS ENUM('all_members', 'active_members', 'specific_categories'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."survey_status" AS ENUM('draft', 'active', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."survey_type" AS ENUM('anonymous', 'identified'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."job_application_status" AS ENUM('applied', 'screening', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."job_posting_status" AS ENUM('draft', 'active', 'filled', 'expired', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."job_posting_type" AS ENUM('full_time', 'part_time', 'contract', 'fellowship', 'internship'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."listing_status" AS ENUM('draft', 'active', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'fulfilled', 'cancelled', 'refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."vendor_category" AS ENUM('emr', 'supplies', 'insurance', 'telehealth', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."vendor_status" AS ENUM('pending', 'verified', 'suspended', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."dashboard_output_format" AS ENUM('pdf', 'csv'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."dashboard_report_type" AS ENUM('association_summary', 'dues_collection', 'cpd_compliance', 'activity'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'waitlist.promoted';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'event.late-cancellation';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'dunning.escalation';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'task.overdue';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"creative_id" uuid NOT NULL,
	"reporter_person_id" uuid NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advertiser" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_person_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"advertiser_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"target_segment_id" text,
	"target_segment_size" integer,
	"budget_cents" integer DEFAULT 0 NOT NULL,
	"spent_cents" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"ad_slot" "ad_slot" DEFAULT 'feed_banner' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_creative" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_text" text NOT NULL,
	"image_url" text,
	"click_url" text,
	"status" "creative_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"sponsored_label" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_ad_opt_out" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"opted_out_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_cpd_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"required_credits" integer DEFAULT 60 NOT NULL,
	"cycle_length_years" integer DEFAULT 3 NOT NULL,
	"sdl_cap_percent" integer DEFAULT 40 NOT NULL,
	"activity_type_minimums" jsonb,
	"cycle_start_month" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "uq_org_cpd_config_org" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_retry_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"idempotency_key" varchar(255) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "webhook_retry_status" DEFAULT 'processing' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "webhook_retry_idempotency_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disciplinary_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"target_person_id" uuid NOT NULL,
	"issued_by" uuid NOT NULL,
	"action_type" "disciplinary_action_type" NOT NULL,
	"reason" text NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transition_checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"officer_term_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"item" varchar(500) NOT NULL,
	"status" "transition_checklist_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "special_assessment_target" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"assessment_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"invoice_id" uuid,
	"target_status" "assessment_target_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "special_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"amount" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"due_date" date NOT NULL,
	"fund_id" uuid,
	"applies_to" "assessment_applies_to" DEFAULT 'all' NOT NULL,
	"status" "assessment_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "committee_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"assignee_id" uuid,
	"status" "committee_task_status" DEFAULT 'pending' NOT NULL,
	"priority" "committee_task_priority" DEFAULT 'medium' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "committee_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "committee_member_role" DEFAULT 'member' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "committee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"status" "committee_status" DEFAULT 'active' NOT NULL,
	"dissolved_at" timestamp with time zone,
	"dissolved_by" uuid,
	"dissolution_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"provider" "gateway_provider" DEFAULT 'stripe' NOT NULL,
	"encrypted_secret_key" text NOT NULL,
	"encrypted_webhook_secret" text,
	"test_mode" boolean DEFAULT true NOT NULL,
	"api_url" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "billing_configs_org_provider_mode_unique" UNIQUE("organization_id","provider","test_mode")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_certificate_seq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"org_code" varchar(20) NOT NULL,
	CONSTRAINT "org_cert_seq_org_year_unique" UNIQUE("organization_id","year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_segment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"filters" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feed_muted_author" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"member_id" uuid NOT NULL,
	"muted_author_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feed_post_reaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"post_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"reaction_type" varchar(50) DEFAULT 'like' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feed_post_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"post_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feed_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"post_type" "feed_post_type" NOT NULL,
	"body_text" text NOT NULL,
	"visibility" "feed_post_visibility" DEFAULT 'org' NOT NULL,
	"status" "feed_post_status" DEFAULT 'published' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_sponsored" boolean DEFAULT false NOT NULL,
	"is_removed" boolean DEFAULT false NOT NULL,
	"removed_by" uuid,
	"removed_reason" text,
	"report_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "survey_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"responder_id" uuid NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"context_id" uuid,
	CONSTRAINT "survey_responses_survey_responder_unique" UNIQUE("survey_id","responder_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "survey" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"survey_type" varchar(20) NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"analytics_snapshot" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"token_hash" varchar(128) NOT NULL,
	"person_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by_officer" uuid NOT NULL,
	CONSTRAINT "payment_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"posting_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"resume_ref" varchar(500),
	"cover_letter" text,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "job_application_status" DEFAULT 'applied' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_posting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"organization_name" varchar(255) NOT NULL,
	"location" varchar(500),
	"type" "job_posting_type" DEFAULT 'full_time' NOT NULL,
	"salary" varchar(255),
	"description" text,
	"requirements" jsonb,
	"posted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"status" "job_posting_status" DEFAULT 'draft' NOT NULL,
	"posted_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketplace_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(10, 2),
	"currency" text DEFAULT 'USD',
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"category_tags" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketplace_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_person_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"fulfilled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"category" "vendor_category" NOT NULL,
	"description" text NOT NULL,
	"verification_status" "vendor_status" DEFAULT 'pending' NOT NULL,
	"website_url" text,
	"contact_email" text NOT NULL,
	"contact_person_id" uuid,
	"verified_at" timestamp with time zone,
	"verified_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chapter_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"org_id" uuid NOT NULL,
	"association_id" uuid NOT NULL,
	"snapshot_month" varchar(7) NOT NULL,
	"total_members" integer NOT NULL,
	"active_members" integer,
	"grace_members" integer,
	"lapsed_members" integer,
	"suspended_members" integer,
	"collection_rate" numeric,
	"total_collected" numeric,
	"total_expected" numeric,
	"cpd_compliance_rate" numeric,
	"avg_credits_per_member" numeric,
	"activity_count_90d" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dashboard_export_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"exported_by" uuid NOT NULL,
	"association_id" uuid NOT NULL,
	"report_type" "dashboard_report_type" NOT NULL,
	"scope" text NOT NULL,
	"date_range_start" timestamp with time zone NOT NULL,
	"date_range_end" timestamp with time zone NOT NULL,
	"output_format" "dashboard_output_format" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "national_dashboard_access" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"association_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"granted_by" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "status" SET DEFAULT 'pendingPayment'::text;--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "from_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "to_status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."membership_status";--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."membership_status" AS ENUM('pendingPayment', 'active', 'gracePeriod', 'lapsed', 'expired', 'suspended', 'removed', 'resigned', 'deceased', 'expelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "status" SET DEFAULT 'pendingPayment'::"public"."membership_status";--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "status" SET DATA TYPE "public"."membership_status" USING "status"::"public"."membership_status";--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "from_status" SET DATA TYPE "public"."membership_status" USING "from_status"::"public"."membership_status";--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "to_status" SET DATA TYPE "public"."membership_status" USING "to_status"::"public"."membership_status";--> statement-breakpoint
ALTER TABLE "dues_gateway_config" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "billing_config" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "billing_config" ALTER COLUMN "provider" SET DEFAULT 'stripe'::text;--> statement-breakpoint
DROP TYPE "public"."gateway_provider";--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."gateway_provider" AS ENUM('stripe', 'paymongo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "dues_gateway_config" ALTER COLUMN "provider" SET DATA TYPE "public"."gateway_provider" USING "provider"::"public"."gateway_provider";--> statement-breakpoint
ALTER TABLE "billing_config" ALTER COLUMN "provider" SET DEFAULT 'stripe'::"public"."gateway_provider";--> statement-breakpoint
ALTER TABLE "billing_config" ALTER COLUMN "provider" SET DATA TYPE "public"."gateway_provider" USING "provider"::"public"."gateway_provider";--> statement-breakpoint
ALTER TABLE "affiliation_transfer" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "affiliation_transfer" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "affiliation_transfer" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "affiliation_transfer" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "affiliation_transfer" ALTER COLUMN "requested_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "affiliation_transfer" ALTER COLUMN "requested_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "affiliation_transfer" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chapter_affiliation" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chapter_affiliation" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chapter_affiliation" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chapter_affiliation" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chapter_affiliation" ALTER COLUMN "affiliated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "royalty_split" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "royalty_split" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "royalty_split" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "royalty_split" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "credential_template" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credential_template" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "credential_template" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credential_template" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "digital_credential" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "digital_credential" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "digital_credential" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "digital_credential" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "digital_credential" ALTER COLUMN "issued_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "digital_credential" ALTER COLUMN "issued_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "digital_credential" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "digital_credential" ALTER COLUMN "revoked_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "license_renewal_alert" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "license_renewal_alert" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "license_renewal_alert" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "license_renewal_alert" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "professional_license" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "professional_license" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "professional_license" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "professional_license" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "professional_license" ALTER COLUMN "verified_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
-- compliance_standings MV (from 0046_wave2b_compliance_view) depends on credit_entry.updated_at.
-- Postgres blocks ALTER COLUMN SET DATA TYPE on view-referenced columns, so drop the MV,
-- run the credit_entry type changes, then recreate the MV verbatim from 0046.
DROP MATERIALIZED VIEW IF EXISTS compliance_standings;--> statement-breakpoint
ALTER TABLE "credit_entry" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_entry" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "credit_entry" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_entry" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "credit_entry" ALTER COLUMN "activity_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_entry" ALTER COLUMN "cycle_start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_entry" ALTER COLUMN "cycle_end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS compliance_standings AS
SELECT ce.person_id,ce.organization_id,COALESCE(SUM(ce.credit_amount),0) AS total_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='General'),0) AS general_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='Major'),0) AS major_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='Self-Directed'),0) AS sdl_credits,
COUNT(*) AS entry_count,COALESCE(occ.required_credits,60) AS required_credits,
COALESCE(occ.sdl_cap_percent,40) AS sdl_cap_percent,
CASE WHEN COALESCE(occ.required_credits,60)=0 THEN 100 ELSE LEAST(ROUND((COALESCE(SUM(ce.credit_amount),0)::numeric/COALESCE(occ.required_credits,60))*100,1),100) END AS compliance_percent,
CASE WHEN COALESCE(SUM(ce.credit_amount),0)>=COALESCE(occ.required_credits,60) THEN 'compliant' WHEN COALESCE(SUM(ce.credit_amount),0)>=COALESCE(occ.required_credits,60)*0.6 THEN 'at_risk' ELSE 'non_compliant' END AS compliance_status,
MAX(ce.updated_at) AS last_credit_at
FROM credit_entry ce LEFT JOIN org_cpd_config occ ON occ.organization_id=ce.organization_id WHERE ce.status='active' GROUP BY ce.person_id,ce.organization_id,occ.required_credits,occ.sdl_cap_percent;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_standings_pk ON compliance_standings (person_id,organization_id);--> statement-breakpoint
ALTER TABLE "directory_profile" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directory_profile" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "directory_profile" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directory_profile" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "directory_profile" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directory_profile" ALTER COLUMN "last_updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directory_profile" ALTER COLUMN "last_updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "aging_bucket" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aging_bucket" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "aging_bucket" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aging_bucket" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_config" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_config" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_config" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_config" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_invoice" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_invoice" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_invoice" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_invoice" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_invoice" ALTER COLUMN "generated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_invoice" ALTER COLUMN "generated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_invoice" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_invoice" ALTER COLUMN "paid_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_reminder_log" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_reminder_log" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_reminder_log" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_reminder_log" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_reminder_log" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_reminder_log" ALTER COLUMN "sent_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dunning_event" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dunning_event" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dunning_event" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dunning_event" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dunning_event" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dunning_template" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dunning_template" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dunning_template" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dunning_template" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "officer_term" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "officer_term" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "officer_term" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "officer_term" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "officer_term" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "officer_term" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "position" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "position" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "position" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "position" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership_application" ALTER COLUMN "reviewed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_category" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_category" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership_category" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_category" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership_tier" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_tier" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership_tier" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_tier" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "joined_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "suspended_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "changed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_status_history" ALTER COLUMN "changed_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "check_in" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "check_in" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "check_in" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "check_in" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "check_in" ALTER COLUMN "checked_in_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "check_in" ALTER COLUMN "checked_in_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "registered_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "registered_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "cancelled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "refunded_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "waitlist_entry" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "waitlist_entry" ALTER COLUMN "joined_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ALTER COLUMN "joined_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "waitlist_entry" ALTER COLUMN "promoted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course_enrollment" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course_enrollment" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "course_enrollment" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course_enrollment" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "course_enrollment" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "course" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "course" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "quiz_attempt" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "quiz_attempt" ALTER COLUMN "attempted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ALTER COLUMN "attempted_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "training_enrollment" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_enrollment" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "training_enrollment" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_enrollment" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "training_enrollment" ALTER COLUMN "enrolled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_enrollment" ALTER COLUMN "enrolled_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "training_enrollment" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_enrollment" ALTER COLUMN "cancelled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "training" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "training" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log_entry" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log_entry" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "audit_log_entry" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log_entry" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "audit_log_entry" ALTER COLUMN "archived_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log_entry" ALTER COLUMN "purge_after" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invoice_line_item" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "payment_due_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "paid_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "voided_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "authorized_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchant_account" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchant_account" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "merchant_account" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "merchant_account" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "booking_event" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_event" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "booking_event" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_event" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "booking_event" ALTER COLUMN "effective_from" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking_event" ALTER COLUMN "effective_from" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "booking_event" ALTER COLUMN "effective_to" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "booked_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "booked_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "confirmation_timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "cancelled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "no_show_marked_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedule_exception" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedule_exception" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "schedule_exception" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedule_exception" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "schedule_exception" ALTER COLUMN "start_datetime" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedule_exception" ALTER COLUMN "end_datetime" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_slot" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_slot" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "time_slot" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_slot" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "time_slot" ALTER COLUMN "start_time" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_slot" ALTER COLUMN "end_time" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificate" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificate" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "certificate" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificate" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "certificate" ALTER COLUMN "issued_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificate" ALTER COLUMN "issued_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "timestamp" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chat_room" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_room" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chat_room" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_room" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "chat_room" ALTER COLUMN "last_message_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcement_stats" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcement_stats" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "announcement_stats" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcement_stats" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "announcement" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcement" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "announcement" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcement" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "announcement" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "announcement" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message_template" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message_template" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "message_template" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message_template" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person_subscription" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person_subscription" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "person_subscription" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person_subscription" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "subscription_topic" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_topic" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "subscription_topic" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_topic" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_access_log" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_access_log" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_access_log" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_access_log" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_access_log" ALTER COLUMN "accessed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_access_log" ALTER COLUMN "accessed_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_tag" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_tag" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_tag" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_tag" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_version" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_version" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document_version" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_version" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_category_override" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_category_override" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_category_override" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_category_override" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_fund_allocation" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_fund_allocation" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_fund_allocation" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_fund_allocation" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_fund" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_fund" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_fund" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_fund" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_gateway_config" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_gateway_config" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_gateway_config" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_gateway_config" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_gateway_config" ALTER COLUMN "last_test_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_org_config" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_org_config" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_org_config" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_org_config" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_payment" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_payment" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_payment" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_payment" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_payment" ALTER COLUMN "paid_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_payment" ALTER COLUMN "expired_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_reminder_schedule" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_reminder_schedule" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_reminder_schedule" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_reminder_schedule" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ALTER COLUMN "changed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_payment_status_history" ALTER COLUMN "changed_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "election_nominee" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election_nominee" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "election_nominee" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election_nominee" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "election_vote" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election_vote" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "election_vote" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election_vote" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "nominations_open_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "nominations_close_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "voting_open_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "voting_close_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "election" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "last_attempt_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "next_retry_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ALTER COLUMN "cancelled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_template" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_template" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_template" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_template" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_suppression" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_suppression" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_suppression" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_suppression" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_suppression" ALTER COLUMN "suppressed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_suppression" ALTER COLUMN "suppressed_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invitation_token" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitation_token" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invitation_token" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitation_token" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "invitation_token" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitation_token" ALTER COLUMN "claimed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "read_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_preference" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_preference" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notification_preference" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_preference" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "deletion_requested_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "deletion_scheduled_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "deletion_completed_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person_privacy_setting" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person_privacy_setting" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "person_privacy_setting" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "person_privacy_setting" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "association" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "association" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "association" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "association" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "feature_flag" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feature_flag" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "feature_flag" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feature_flag" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "impersonation_session" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "impersonation_session" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "impersonation_session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "impersonation_session" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "impersonation_session" ALTER COLUMN "started_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "impersonation_session" ALTER COLUMN "started_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "impersonation_session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "impersonation_session" ALTER COLUMN "ended_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "trial_start_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "trial_end_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_admin" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_admin" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "platform_admin" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_admin" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "stored_file" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stored_file" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "stored_file" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stored_file" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "stored_file" ALTER COLUMN "uploaded_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stored_file" ALTER COLUMN "uploaded_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "accredited_provider" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accredited_provider" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "accredited_provider" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accredited_provider" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "accredited_provider" ALTER COLUMN "expiry_date" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN IF NOT EXISTS "source_type" "credit_source_type";--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN IF NOT EXISTS "source_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN IF NOT EXISTS "cpd_activity_type" "cpd_activity_type";--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN IF NOT EXISTS "attestation" jsonb;--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN IF NOT EXISTS "status" "credit_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "credit_entry" ADD COLUMN IF NOT EXISTS "voided_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "dues_config" ADD COLUMN IF NOT EXISTS "due_date_day" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "dues_config" ADD COLUMN IF NOT EXISTS "cycle_start_month" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "removal_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "check_in" ADD COLUMN IF NOT EXISTS "attestation" jsonb;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "cpd_activity_type" "cpd_activity_type";--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "event_slug" varchar(300);--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "cover_image_url" varchar(2048);--> statement-breakpoint
ALTER TABLE "audit_log_entry" ADD COLUMN IF NOT EXISTS "event_sub_type" varchar(100);--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "template_id" varchar(100);--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "signing_officer_id" uuid;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "credit_hours" integer;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "cpd_activity_type" "cpd_activity_type";--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "status" "certificate_status" DEFAULT 'issued';--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "pdf_url" varchar(500);--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "revoked_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "dues_payment" ADD COLUMN IF NOT EXISTS "refund_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dues_payment" ADD COLUMN IF NOT EXISTS "refund_reason" text;--> statement-breakpoint
ALTER TABLE "person_privacy_setting" ADD COLUMN IF NOT EXISTS "credentials_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "person_privacy_setting" ADD COLUMN IF NOT EXISTS "dues_status_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "person_privacy_setting" ADD COLUMN IF NOT EXISTS "ce_compliance_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "association" ADD COLUMN IF NOT EXISTS "cycle_start_month" integer;--> statement-breakpoint
ALTER TABLE "association" ADD COLUMN IF NOT EXISTS "cycle_start_day" integer;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ad_report" ADD CONSTRAINT "ad_report_creative_id_ad_creative_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."ad_creative"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ad_campaign" ADD CONSTRAINT "ad_campaign_advertiser_id_advertiser_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."advertiser"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "ad_creative" ADD CONSTRAINT "ad_creative_campaign_id_ad_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."ad_campaign"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "webhook_retry_log" ADD CONSTRAINT "webhook_retry_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "transition_checklist" ADD CONSTRAINT "transition_checklist_officer_term_id_officer_term_id_fk" FOREIGN KEY ("officer_term_id") REFERENCES "public"."officer_term"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "special_assessment_target" ADD CONSTRAINT "special_assessment_target_assessment_id_special_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."special_assessment"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "special_assessment_target" ADD CONSTRAINT "special_assessment_target_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "special_assessment_target" ADD CONSTRAINT "special_assessment_target_invoice_id_dues_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."dues_invoice"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "special_assessment" ADD CONSTRAINT "special_assessment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "special_assessment" ADD CONSTRAINT "special_assessment_fund_id_dues_fund_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."dues_fund"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_survey_id_survey_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_responder_id_person_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "survey" ADD CONSTRAINT "survey_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payment_token" ADD CONSTRAINT "payment_token_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payment_token" ADD CONSTRAINT "payment_token_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payment_token" ADD CONSTRAINT "payment_token_created_by_officer_person_id_fk" FOREIGN KEY ("created_by_officer") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "marketplace_listing" ADD CONSTRAINT "marketplace_listing_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_listing_id_marketplace_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listing"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_reports_creative_idx" ON "ad_report" USING btree ("creative_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "advertisers_org_idx" ON "advertiser" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_org_idx" ON "ad_campaign" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_advertiser_idx" ON "ad_campaign" USING btree ("advertiser_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "ad_campaign" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_slot_idx" ON "ad_campaign" USING btree ("ad_slot");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creatives_campaign_idx" ON "ad_creative" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creatives_status_idx" ON "ad_creative" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_opt_out_person_idx" ON "member_ad_opt_out" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_opt_out_org_person_idx" ON "member_ad_opt_out" USING btree ("organization_id","person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_retry_org_idx" ON "webhook_retry_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_retry_status_idx" ON "webhook_retry_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_retry_next_retry_idx" ON "webhook_retry_log" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disciplinary_action_org" ON "disciplinary_action" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disciplinary_action_target" ON "disciplinary_action" USING btree ("target_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_disciplinary_action_issuer" ON "disciplinary_action" USING btree ("issued_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transition_checklist_term" ON "transition_checklist" USING btree ("officer_term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transition_checklist_org" ON "transition_checklist" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "special_assessment_target_assessment_idx" ON "special_assessment_target" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "special_assessment_target_person_idx" ON "special_assessment_target" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "special_assessment_target_assessment_person_idx" ON "special_assessment_target" USING btree ("assessment_id","person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "special_assessment_org_idx" ON "special_assessment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "special_assessment_org_status_idx" ON "special_assessment" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_task_org" ON "committee_task" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_task_committee" ON "committee_task" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_task_assignee" ON "committee_task" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_task_status" ON "committee_task" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_task_due" ON "committee_task" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_member_org" ON "committee_member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_member_committee" ON "committee_member" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_member_person" ON "committee_member" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_org" ON "committee" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_committee_status" ON "committee" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_configs_org_idx" ON "billing_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_segment_org_idx" ON "saved_segment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feed_muted_member" ON "feed_muted_author" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feed_muted_org" ON "feed_muted_author" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feed_reaction_post" ON "feed_post_reaction" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feed_reaction_member" ON "feed_post_reaction" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feed_report_post" ON "feed_post_report" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feed_post_org" ON "feed_post" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feed_post_author" ON "feed_post" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_feed_post_status" ON "feed_post" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "survey_responses_org_idx" ON "survey_response" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "survey_responses_survey_idx" ON "survey_response" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "survey_responses_responder_idx" ON "survey_response" USING btree ("responder_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "survey_responses_status_idx" ON "survey_response" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "surveys_org_idx" ON "survey" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "surveys_status_idx" ON "survey" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "surveys_type_idx" ON "survey" USING btree ("survey_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "surveys_created_by_idx" ON "survey" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_token_hash" ON "payment_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_token_person" ON "payment_token" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payment_token_org" ON "payment_token" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_app_posting" ON "job_application" USING btree ("posting_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_app_person" ON "job_application" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_app_status" ON "job_application" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_posting_org" ON "job_posting" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_posting_status" ON "job_posting" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_posting_expires" ON "job_posting" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_job_posting_type" ON "job_posting" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_org_idx" ON "marketplace_listing" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_vendor_idx" ON "marketplace_listing" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_status_idx" ON "marketplace_listing" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_org_idx" ON "marketplace_order" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_buyer_idx" ON "marketplace_order" USING btree ("buyer_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_vendor_idx" ON "marketplace_order" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "marketplace_order" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_listing_idx" ON "marketplace_order" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_org_idx" ON "vendor" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_status_idx" ON "vendor" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_category_idx" ON "vendor" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chapter_snapshot_org" ON "chapter_snapshot" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chapter_snapshot_association" ON "chapter_snapshot" USING btree ("association_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chapter_snapshot_month" ON "chapter_snapshot" USING btree ("snapshot_month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_export_log_association" ON "dashboard_export_log" USING btree ("association_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nda_association" ON "national_dashboard_access" USING btree ("association_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nda_member" ON "national_dashboard_access" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credit_source" ON "credit_entry" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_slug" ON "event" USING btree ("event_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_status_idx" ON "certificate" USING btree ("status");--> statement-breakpoint
ALTER TABLE "membership" DROP COLUMN "terminated_at";--> statement-breakpoint
ALTER TABLE "membership" DROP COLUMN "termination_reason";--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "credit_entry" ADD CONSTRAINT "uq_credit_source_person" UNIQUE("source_type","source_id","person_id"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "event" ADD CONSTRAINT "event_event_slug_unique" UNIQUE("event_slug"); EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;