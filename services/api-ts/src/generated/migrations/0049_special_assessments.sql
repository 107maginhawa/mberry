-- Special assessments: one-time charges alongside dues
-- Schema: special-assessments.schema.ts

DO $$ BEGIN
  CREATE TYPE "assessment_applies_to" AS ENUM('all', 'selected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "assessment_status" AS ENUM('draft', 'active', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "assessment_target_status" AS ENUM('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "special_assessment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "amount" bigint NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'PHP',
  "due_date" date NOT NULL,
  "fund_id" uuid,
  "applies_to" "assessment_applies_to" NOT NULL DEFAULT 'all',
  "status" "assessment_status" NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS "special_assessment_target" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "assessment_id" uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "invoice_id" uuid,
  "target_status" "assessment_target_status" NOT NULL DEFAULT 'pending'
);

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "special_assessment" ADD CONSTRAINT "special_assessment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "special_assessment" ADD CONSTRAINT "special_assessment_fund_id_dues_fund_id_fk" FOREIGN KEY ("fund_id") REFERENCES "dues_fund"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "special_assessment_target" ADD CONSTRAINT "special_assessment_target_assessment_id_special_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "special_assessment"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "special_assessment_target" ADD CONSTRAINT "special_assessment_target_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "special_assessment_target" ADD CONSTRAINT "special_assessment_target_invoice_id_dues_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "dues_invoice"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "special_assessment_org_idx" ON "special_assessment" ("organization_id");
CREATE INDEX IF NOT EXISTS "special_assessment_org_status_idx" ON "special_assessment" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "special_assessment_target_assessment_idx" ON "special_assessment_target" ("assessment_id");
CREATE INDEX IF NOT EXISTS "special_assessment_target_person_idx" ON "special_assessment_target" ("person_id");
CREATE INDEX IF NOT EXISTS "special_assessment_target_assessment_person_idx" ON "special_assessment_target" ("assessment_id", "person_id");
