-- Create credential-related enums and tables
-- Tables: credential_template, digital_credential
-- Required by: listMyCertificates handler

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_type') THEN
    CREATE TYPE "credential_type" AS ENUM ('memberCard', 'certificate', 'badge', 'license');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_template_status') THEN
    CREATE TYPE "credential_template_status" AS ENUM ('active', 'retired');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_status') THEN
    CREATE TYPE "credential_status" AS ENUM ('active', 'suspended', 'revoked', 'expired');
  END IF;
END $$;

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
  "status" "credential_template_status" NOT NULL DEFAULT 'active'
);

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
  "credential_dc_status" "credential_status" NOT NULL DEFAULT 'active',
  "qr_payload" varchar(4096),
  "hmac_key" varchar(256),
  "pdf_url" varchar(2048),
  "verification_url" varchar(2048),
  "revoked_at" timestamp,
  "revocation_reason" varchar(500)
);

CREATE INDEX IF NOT EXISTS "idx_cred_template_org" ON "credential_template" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_cred_template_type" ON "credential_template" ("type");
CREATE INDEX IF NOT EXISTS "idx_cred_template_status" ON "credential_template" ("status");

CREATE INDEX IF NOT EXISTS "idx_dc_org" ON "digital_credential" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_dc_person" ON "digital_credential" ("person_id");
CREATE INDEX IF NOT EXISTS "idx_dc_template" ON "digital_credential" ("template_id");
CREATE INDEX IF NOT EXISTS "idx_dc_status" ON "digital_credential" ("credential_dc_status");
CREATE INDEX IF NOT EXISTS "idx_dc_credential_number" ON "digital_credential" ("credential_number");
