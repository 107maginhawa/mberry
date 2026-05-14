-- Migration: Rename orgId to organizationId for terminology consistency
-- Breaking change: approved for compliance push 8.4→9.5+

-- 1. invitation_token: drop legacy org_id column (data already in organization_id)
-- First migrate any data from org_id to organization_id where organization_id is null
DO $$ BEGIN
UPDATE "invitation_token" SET "organization_id" = "org_id" WHERE "organization_id" IS NULL AND "org_id" IS NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;--> statement-breakpoint

-- Drop the legacy index and column
DROP INDEX IF EXISTS "idx_invite_org";--> statement-breakpoint
ALTER TABLE "invitation_token" DROP COLUMN IF EXISTS "org_id";--> statement-breakpoint

-- Make organization_id NOT NULL now that all data is migrated
ALTER TABLE "invitation_token" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint

-- 2. person_privacy_setting: rename org_id to organization_id
DO $$ BEGIN
ALTER TABLE "person_privacy_setting" RENAME COLUMN "org_id" TO "organization_id";
EXCEPTION WHEN undefined_column THEN NULL;
END $$;