-- F2: Dues module custom tables (not tracked by Drizzle — schema in .types.ts)
-- These tables supplement the existing dues_config/dues_invoice from association:member

DO $$ BEGIN
  CREATE TYPE "public"."billing_frequency" AS ENUM('annual', 'quarterly');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dues_payment_method" AS ENUM('online', 'cash', 'check', 'bank_transfer', 'gcash', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."dues_payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded', 'partially_refunded', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."gateway_provider" AS ENUM('paymongo', 'stripe');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

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
  "grace_period_days" integer DEFAULT 30 NOT NULL
);

CREATE TABLE IF NOT EXISTS "dues_category_override" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "dues_config_id" uuid NOT NULL REFERENCES "dues_org_config"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL,
  "override_amount" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "dues_fund" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "name" varchar(100) NOT NULL,
  "percentage" numeric(5,2) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "dues_payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "person"("id") ON DELETE CASCADE,
  "invoice_id" uuid,
  "receipt_number" varchar(50) NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(3) DEFAULT 'PHP' NOT NULL,
  "payment_method" "dues_payment_method" NOT NULL,
  "reference_number" varchar(100),
  "status" "dues_payment_status" DEFAULT 'pending' NOT NULL,
  "recorded_by" uuid REFERENCES "person"("id"),
  "membership_extended_from" date,
  "membership_extended_to" date,
  "paid_at" timestamp,
  "expired_at" timestamp,
  "refunded_amount" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "dues_fund_allocation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "payment_id" uuid NOT NULL REFERENCES "dues_payment"("id") ON DELETE CASCADE,
  "fund_id" uuid NOT NULL REFERENCES "dues_fund"("id"),
  "amount" integer NOT NULL,
  "is_reversal" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "dues_reminder_schedule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "dues_config_id" uuid NOT NULL REFERENCES "dues_org_config"("id") ON DELETE CASCADE,
  "days_offset" integer NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "channel_inapp" boolean DEFAULT true NOT NULL,
  "channel_push" boolean DEFAULT true NOT NULL,
  "channel_email" boolean DEFAULT true NOT NULL,
  "is_custom" boolean DEFAULT false NOT NULL
);

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
  "last_test_at" timestamp
);

--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "dues_org_config_org_idx" ON "dues_org_config" ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dues_org_config_org_unique" ON "dues_org_config" ("organization_id");
CREATE INDEX IF NOT EXISTS "dues_cat_override_config_idx" ON "dues_category_override" ("dues_config_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dues_cat_override_unique" ON "dues_category_override" ("dues_config_id", "category_id");
CREATE INDEX IF NOT EXISTS "dues_fund_org_idx" ON "dues_fund" ("organization_id");
CREATE INDEX IF NOT EXISTS "dues_fund_org_sort_idx" ON "dues_fund" ("organization_id", "sort_order");
CREATE INDEX IF NOT EXISTS "dues_payment_org_idx" ON "dues_payment" ("organization_id");
CREATE INDEX IF NOT EXISTS "dues_payment_person_idx" ON "dues_payment" ("person_id");
CREATE INDEX IF NOT EXISTS "dues_payment_status_idx" ON "dues_payment" ("status");
CREATE INDEX IF NOT EXISTS "dues_payment_org_person_idx" ON "dues_payment" ("organization_id", "person_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dues_payment_receipt_unique" ON "dues_payment" ("receipt_number");
CREATE INDEX IF NOT EXISTS "dues_fund_alloc_payment_idx" ON "dues_fund_allocation" ("payment_id");
CREATE INDEX IF NOT EXISTS "dues_fund_alloc_fund_idx" ON "dues_fund_allocation" ("fund_id");
CREATE INDEX IF NOT EXISTS "dues_reminder_config_idx" ON "dues_reminder_schedule" ("dues_config_id");
CREATE INDEX IF NOT EXISTS "dues_gateway_org_idx" ON "dues_gateway_config" ("organization_id");
CREATE UNIQUE INDEX IF NOT EXISTS "dues_gateway_org_unique" ON "dues_gateway_config" ("organization_id");
