DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_status') THEN CREATE TYPE "public"."credential_status" AS ENUM('active', 'suspended', 'revoked', 'expired'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_template_status') THEN CREATE TYPE "public"."credential_template_status" AS ENUM('active', 'retired'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_type') THEN CREATE TYPE "public"."credential_type" AS ENUM('memberCard', 'certificate', 'badge', 'license'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_status') THEN CREATE TYPE "public"."license_status" AS ENUM('active', 'expired', 'suspended', 'revoked', 'pending'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'renewal_alert_status') THEN CREATE TYPE "public"."renewal_alert_status" AS ENUM('pending', 'sent', 'acknowledged', 'dismissed'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN CREATE TYPE "public"."event_type" AS ENUM('generalAssembly', 'inductionCeremony', 'fellowship', 'medicalMission', 'boardMeeting', 'committeeMeeting', 'fundraiser', 'other'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_visibility') THEN CREATE TYPE "public"."event_visibility" AS ENUM('internal', 'network'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_status') THEN CREATE TYPE "public"."announcement_status" AS ENUM('draft', 'scheduled', 'sent', 'scheduledFailed', 'archived'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_visibility') THEN CREATE TYPE "public"."announcement_visibility" AS ENUM('internal', 'network'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_frequency') THEN CREATE TYPE "public"."billing_frequency" AS ENUM('annual', 'quarterly'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dues_payment_method') THEN CREATE TYPE "public"."dues_payment_method" AS ENUM('online', 'cash', 'check', 'bankTransfer', 'gcash', 'other'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dues_payment_status') THEN CREATE TYPE "public"."dues_payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded', 'partiallyRefunded', 'expired'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gateway_provider') THEN CREATE TYPE "public"."gateway_provider" AS ENUM('paymongo', 'stripe'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'election_status') THEN CREATE TYPE "public"."election_status" AS ENUM('draft', 'nominationsOpen', 'votingOpen', 'awaitingConfirmation', 'published', 'cancelled'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'election_type') THEN CREATE TYPE "public"."election_type" AS ENUM('officer', 'bylaw'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nominee_status') THEN CREATE TYPE "public"."nominee_status" AS ENUM('nominated', 'accepted', 'declined', 'elected'); END IF; END $$;--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'voting_mode') THEN CREATE TYPE "public"."voting_mode" AS ENUM('online', 'inPerson', 'hybrid'); END IF; END $$;--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'delete-request';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'delete-cancel';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'anonymize';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'export';--> statement-breakpoint
ALTER TYPE "public"."audit_event_type" ADD VALUE 'data-deletion' BEFORE 'system-config';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credential_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "credential_type" NOT NULL,
	"design" varchar(50000),
	"validity_period" integer,
	"status" "credential_template_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "digital_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"membership_id" uuid,
	"credential_number" varchar(100) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"credential_dc_status" "credential_status" DEFAULT 'active' NOT NULL,
	"qr_payload" varchar(4096),
	"hmac_key" varchar(256),
	"pdf_url" varchar(2048),
	"verification_url" varchar(2048),
	"revoked_at" timestamp,
	"revocation_reason" varchar(500)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_renewal_alert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"license_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"alert_date" date NOT NULL,
	"days_until_expiry" integer NOT NULL,
	"status" "renewal_alert_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "professional_license" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"license_type" varchar(100) NOT NULL,
	"license_number" varchar(100) NOT NULL,
	"issuing_authority" varchar(200) NOT NULL,
	"jurisdiction" varchar(100) NOT NULL,
	"issued_date" date NOT NULL,
	"expiration_date" date NOT NULL,
	"status" "license_status" NOT NULL,
	"document_ref" varchar(500),
	"verified_at" timestamp,
	"verified_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certificate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"training_id" uuid NOT NULL,
	"certificate_number" varchar(50) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_cert_num_unique" UNIQUE("certificate_number"),
	CONSTRAINT "certificate_training_person_unique" UNIQUE("training_id","person_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcement_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"recipients" integer DEFAULT 0 NOT NULL,
	"inapp_views" integer DEFAULT 0 NOT NULL,
	"push_delivered" integer DEFAULT 0 NOT NULL,
	"email_sent" integer DEFAULT 0 NOT NULL,
	"email_opened" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"audience_type" varchar(20) DEFAULT 'all' NOT NULL,
	"audience_categories" jsonb,
	"channel_push" boolean DEFAULT true NOT NULL,
	"channel_email" boolean DEFAULT false NOT NULL,
	"visibility" "announcement_visibility" DEFAULT 'internal' NOT NULL,
	"status" "announcement_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dues_category_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"dues_config_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"override_amount" integer NOT NULL,
	CONSTRAINT "dues_cat_override_unique" UNIQUE("dues_config_id","category_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dues_org_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"default_amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"billing_frequency" "billing_frequency" DEFAULT 'annual' NOT NULL,
	"due_date_month" integer,
	"due_date_day" integer DEFAULT 1 NOT NULL,
	"grace_period_days" integer DEFAULT 30 NOT NULL,
	CONSTRAINT "dues_config_org_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dues_fund_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"is_reversal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dues_fund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dues_gateway_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"provider" "gateway_provider" NOT NULL,
	"public_key" varchar(255) NOT NULL,
	"encrypted_secret" text NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"last_test_at" timestamp,
	CONSTRAINT "dues_gateway_org_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dues_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"invoice_id" uuid,
	"receipt_number" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'PHP' NOT NULL,
	"payment_method" "dues_payment_method" NOT NULL,
	"reference_number" varchar(100),
	"status" "dues_payment_status" DEFAULT 'pending' NOT NULL,
	"recorded_by" uuid,
	"membership_extended_from" date,
	"membership_extended_to" date,
	"paid_at" timestamp,
	"expired_at" timestamp,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "dues_payment_receipt_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dues_reminder_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"dues_config_id" uuid NOT NULL,
	"days_offset" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"channel_inapp" boolean DEFAULT true NOT NULL,
	"channel_push" boolean DEFAULT true NOT NULL,
	"channel_email" boolean DEFAULT true NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "election_nominee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"election_id" uuid NOT NULL,
	"position_id" varchar(50) NOT NULL,
	"person_id" uuid NOT NULL,
	"nominated_by" uuid,
	"status" "nominee_status" DEFAULT 'nominated' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "election_vote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"election_id" uuid NOT NULL,
	"position_id" varchar(50) NOT NULL,
	"nominee_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "election" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"type" "election_type" DEFAULT 'officer' NOT NULL,
	"status" "election_status" DEFAULT 'draft' NOT NULL,
	"voting_mode" "voting_mode" DEFAULT 'online' NOT NULL,
	"nominations_open_at" timestamp,
	"nominations_close_at" timestamp,
	"voting_open_at" timestamp,
	"voting_close_at" timestamp,
	"passage_threshold" integer,
	"positions" jsonb,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"person_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_privacy_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"person_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"email_visible" boolean DEFAULT false NOT NULL,
	"phone_visible" boolean DEFAULT false NOT NULL,
	"photo_visible" boolean DEFAULT true NOT NULL,
	"address_visible" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliation_transfer" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "chapter_affiliation" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "royalty_split" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "directory_profile" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "membership_application" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "membership_tier" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "membership" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "check_in" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "event_registration" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "event" RENAME COLUMN "tenant_id" TO "event_type";--> statement-breakpoint
ALTER TABLE "course_enrollment" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "quiz_attempt" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "training_enrollment" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "message_template" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "message" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "person_subscription" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "subscription_topic" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "document_tag" RENAME COLUMN "tenant_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "document_version" RENAME COLUMN "file_id" TO "organization_id";--> statement-breakpoint
ALTER TABLE "document_version" RENAME COLUMN "mime_type" TO "storage_key";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "tenant_id" TO "file_name";--> statement-breakpoint
ALTER TABLE "document" RENAME COLUMN "description" TO "size";--> statement-breakpoint
DROP INDEX "affiliation_transfer_tenant_status_idx";--> statement-breakpoint
DROP INDEX "chapter_affiliation_tenant_person_idx";--> statement-breakpoint
DROP INDEX "chapter_affiliation_tenant_chapter_idx";--> statement-breakpoint
DROP INDEX "royalty_split_tenant_chapter_idx";--> statement-breakpoint
DROP INDEX "royalty_split_tenant_membership_idx";--> statement-breakpoint
DROP INDEX "idx_credit_tenant";--> statement-breakpoint
DROP INDEX "directory_profile_tenant_person_idx";--> statement-breakpoint
DROP INDEX "directory_profile_tenant_visibility_idx";--> statement-breakpoint
DROP INDEX "aging_bucket_tenant_org_idx";--> statement-breakpoint
DROP INDEX "dues_config_tenant_org_idx";--> statement-breakpoint
DROP INDEX "dues_invoice_tenant_org_status_idx";--> statement-breakpoint
DROP INDEX "dues_invoice_tenant_membership_idx";--> statement-breakpoint
DROP INDEX "idx_officer_term_tenant";--> statement-breakpoint
DROP INDEX "idx_position_tenant";--> statement-breakpoint
DROP INDEX "membership_app_tenant_org_status_idx";--> statement-breakpoint
DROP INDEX "membership_category_tenant_idx";--> statement-breakpoint
DROP INDEX "membership_tier_tenant_idx";--> statement-breakpoint
DROP INDEX "membership_tier_tenant_code_idx";--> statement-breakpoint
DROP INDEX "membership_tenant_org_idx";--> statement-breakpoint
DROP INDEX "membership_tenant_person_idx";--> statement-breakpoint
DROP INDEX "membership_tenant_status_idx";--> statement-breakpoint
DROP INDEX "idx_event_tenant";--> statement-breakpoint
DROP INDEX "idx_course_tenant";--> statement-breakpoint
DROP INDEX "idx_training_tenant";--> statement-breakpoint
DROP INDEX "idx_msg_template_tenant";--> statement-breakpoint
DROP INDEX "idx_message_tenant";--> statement-breakpoint
DROP INDEX "idx_sub_topic_tenant";--> statement-breakpoint
DROP INDEX "idx_doctag_tenant";--> statement-breakpoint
DROP INDEX "idx_doc_tenant";--> statement-breakpoint
ALTER TABLE "membership_category" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "visibility" "event_visibility" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log_entry" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_item" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "merchant_account" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_event" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_exception" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "time_slot" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_room" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "document_access_log" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "mime_type" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "storage_key" varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "owner_type" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "access_level" varchar(50) DEFAULT 'orgOnly' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "email_template" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "deletion_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "deletion_scheduled_at" timestamp;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "deletion_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "stored_file" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "certificate" ADD CONSTRAINT "certificate_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_stats" ADD CONSTRAINT "announcement_stats_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_author_id_person_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_category_override" ADD CONSTRAINT "dues_category_override_dues_config_id_dues_org_config_id_fk" FOREIGN KEY ("dues_config_id") REFERENCES "public"."dues_org_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_fund_allocation" ADD CONSTRAINT "dues_fund_allocation_payment_id_dues_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."dues_payment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_fund_allocation" ADD CONSTRAINT "dues_fund_allocation_fund_id_dues_fund_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."dues_fund"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_payment" ADD CONSTRAINT "dues_payment_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_payment" ADD CONSTRAINT "dues_payment_recorded_by_person_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues_reminder_schedule" ADD CONSTRAINT "dues_reminder_schedule_dues_config_id_dues_org_config_id_fk" FOREIGN KEY ("dues_config_id") REFERENCES "public"."dues_org_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_nominee" ADD CONSTRAINT "election_nominee_election_id_election_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."election"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_nominee" ADD CONSTRAINT "election_nominee_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_nominee" ADD CONSTRAINT "election_nominee_nominated_by_person_id_fk" FOREIGN KEY ("nominated_by") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_election_id_election_id_fk" FOREIGN KEY ("election_id") REFERENCES "public"."election"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_nominee_id_election_nominee_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."election_nominee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_voter_id_person_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cred_template_org" ON "credential_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cred_template_type" ON "credential_template" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cred_template_status" ON "credential_template" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dc_org" ON "digital_credential" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dc_person" ON "digital_credential" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dc_template" ON "digital_credential" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dc_status" ON "digital_credential" USING btree ("credential_dc_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dc_credential_number" ON "digital_credential" USING btree ("credential_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_renewal_alert_org" ON "license_renewal_alert" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_renewal_alert_license" ON "license_renewal_alert" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_renewal_alert_person" ON "license_renewal_alert" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_renewal_alert_status" ON "license_renewal_alert" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_license_org" ON "professional_license" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_license_person" ON "professional_license" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_license_status" ON "professional_license" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_license_expiration" ON "professional_license" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_org_idx" ON "certificate" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_person_idx" ON "certificate" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_training_idx" ON "certificate" USING btree ("training_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ann_stats_org_idx" ON "announcement_stats" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ann_stats_announcement_idx" ON "announcement_stats" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcement_org_idx" ON "announcement" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcement_status_idx" ON "announcement" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcement_org_status_idx" ON "announcement" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_cat_override_org_idx" ON "dues_category_override" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_cat_override_config_idx" ON "dues_category_override" USING btree ("dues_config_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_config_org_idx" ON "dues_org_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_fund_alloc_org_idx" ON "dues_fund_allocation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_fund_alloc_payment_idx" ON "dues_fund_allocation" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_fund_alloc_fund_idx" ON "dues_fund_allocation" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_fund_org_idx" ON "dues_fund" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_fund_org_sort_idx" ON "dues_fund" USING btree ("organization_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_gateway_org_idx" ON "dues_gateway_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_payment_org_idx" ON "dues_payment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_payment_person_idx" ON "dues_payment" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_payment_status_idx" ON "dues_payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_payment_org_person_idx" ON "dues_payment" USING btree ("organization_id","person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_reminder_org_idx" ON "dues_reminder_schedule" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_reminder_config_idx" ON "dues_reminder_schedule" USING btree ("dues_config_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nominee_org_idx" ON "election_nominee" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nominee_election_idx" ON "election_nominee" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nominee_person_idx" ON "election_nominee" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vote_org_idx" ON "election_vote" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vote_election_idx" ON "election_vote" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vote_voter_idx" ON "election_vote" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vote_election_voter_idx" ON "election_vote" USING btree ("election_id","voter_id","position_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "election_org_idx" ON "election" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "election_status_idx" ON "election" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notif_pref_person_cat_org_idx" ON "notification_preference" USING btree ("person_id","category","organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_pref_person_idx" ON "notification_preference" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_pref_org_idx" ON "notification_preference" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "privacy_person_org_idx" ON "person_privacy_setting" USING btree ("person_id","org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_person_idx" ON "person_privacy_setting" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliation_transfer_org_status_idx" ON "affiliation_transfer" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chapter_affiliation_org_person_idx" ON "chapter_affiliation" USING btree ("organization_id","person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chapter_affiliation_org_chapter_idx" ON "chapter_affiliation" USING btree ("organization_id","chapter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "royalty_split_org_chapter_idx" ON "royalty_split" USING btree ("organization_id","chapter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "royalty_split_org_membership_idx" ON "royalty_split" USING btree ("organization_id","membership_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "directory_profile_org_person_idx" ON "directory_profile" USING btree ("organization_id","person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "directory_profile_org_visibility_idx" ON "directory_profile" USING btree ("organization_id","visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aging_bucket_org_idx" ON "aging_bucket" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_config_legacy_org_idx" ON "dues_config" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_invoice_org_status_idx" ON "dues_invoice" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_invoice_membership_idx" ON "dues_invoice" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_app_org_status_idx" ON "membership_application" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_category_org_idx" ON "membership_category" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_tier_org_idx" ON "membership_tier" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_tier_org_code_idx" ON "membership_tier" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_org_person_idx" ON "membership" USING btree ("organization_id","person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "membership_org_status_idx" ON "membership" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_checkin_org" ON "check_in" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_reg_org" ON "event_registration" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_waitlist_org" ON "waitlist_entry" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_course_enroll_org" ON "course_enrollment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_quiz_org" ON "quiz_attempt" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_training_enroll_org" ON "training_enrollment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_organization_id_idx" ON "audit_log_entry" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_org_event_idx" ON "audit_log_entry" USING btree ("organization_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_items_org_idx" ON "invoice_line_item" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_idx" ON "invoice" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchant_accounts_org_idx" ON "merchant_account" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_events_org_idx" ON "booking_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_org_idx" ON "booking" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_exceptions_org_idx" ON "schedule_exception" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_slots_org_idx" ON "time_slot" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_org_idx" ON "chat_message" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_rooms_org_idx" ON "chat_room" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_msg_template_org" ON "message_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_message_org" ON "message" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_person_sub_org" ON "person_subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sub_topic_org" ON "subscription_topic" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_docaccess_org" ON "document_access_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doctag_org" ON "document_tag" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doc_owner" ON "document" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_queue_org_idx" ON "email_queue" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_template_org_idx" ON "email_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_org_idx" ON "notification" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_org_slug" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_org_idx" ON "review" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stored_files_org_idx" ON "stored_file" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stored_files_owner_idx" ON "stored_file" USING btree ("owner");--> statement-breakpoint
ALTER TABLE "credit_entry" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "aging_bucket" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "dues_config" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "dues_invoice" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "officer_term" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "position" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "membership_application" DROP COLUMN "org_id";--> statement-breakpoint
ALTER TABLE "membership_category" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "membership_category" DROP COLUMN "org_id";--> statement-breakpoint
ALTER TABLE "membership" DROP COLUMN "org_id";--> statement-breakpoint
ALTER TABLE "waitlist_entry" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "course" DROP COLUMN "tenant_id";--> statement-breakpoint
ALTER TABLE "training" DROP COLUMN "tenant_id";