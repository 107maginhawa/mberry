-- 0014_data_model_unification.sql
-- Phase 3: Data Model Unification — remove tenantId columns from all association module tables.
-- D-08: Single atomic migration, zero data loss.
-- D-02: Drop tenant_id where organization_id already exists; rename where only tenant_id exists.

-- ---------------------------------------------------------------------------
-- Wave 1: DROP tenant_id from tables that ALSO have organization_id
-- (data already captured in organization_id; DROP is safe)
-- ---------------------------------------------------------------------------

-- training module (has both tenant_id AND organization_id)
ALTER TABLE "training" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "training_enrollment" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "course" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "course_enrollment" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "quiz_attempt" DROP COLUMN IF EXISTS "tenant_id";

-- events module (has both tenant_id AND organization_id)
ALTER TABLE "event" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "event_registration" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "check_in" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "waitlist_entry" DROP COLUMN IF EXISTS "tenant_id";

-- dues module (has both tenant_id AND organization_id)
ALTER TABLE "dues_config" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "dues_invoice" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "aging_bucket" DROP COLUMN IF EXISTS "tenant_id";

-- governance module (has both tenant_id AND organization_id)
ALTER TABLE "position" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "officer_term" DROP COLUMN IF EXISTS "tenant_id";

-- credits module (has both tenant_id AND organization_id)
ALTER TABLE "credit_entry" DROP COLUMN IF EXISTS "tenant_id";

-- ---------------------------------------------------------------------------
-- Wave 2: RENAME tenant_id → organization_id for tables with ONLY tenant_id
-- (no organization_id column exists; RENAME preserves data)
-- ---------------------------------------------------------------------------

-- membership module (only tenant_id; orgId is a separate chapter/org FK)
ALTER TABLE "membership_tier" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "membership_category" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "membership" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "membership_application" RENAME COLUMN "tenant_id" TO "organization_id";

-- chapters module (only tenant_id)
ALTER TABLE "chapter_affiliation" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "affiliation_transfer" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "royalty_split" RENAME COLUMN "tenant_id" TO "organization_id";

-- credentials module (only tenant_id)
ALTER TABLE "professional_license" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "license_renewal_alert" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "credential_template" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "digital_credential" RENAME COLUMN "tenant_id" TO "organization_id";

-- directory module (only tenant_id)
ALTER TABLE "directory_profile" RENAME COLUMN "tenant_id" TO "organization_id";

-- communication module (only tenant_id)
ALTER TABLE "message_template" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "message" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "subscription_topic" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "person_subscription" RENAME COLUMN "tenant_id" TO "organization_id";

-- documents module (only tenant_id)
ALTER TABLE "document" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "document_version" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "document_tag" RENAME COLUMN "tenant_id" TO "organization_id";

-- ---------------------------------------------------------------------------
-- Wave 2b: Also drop the redundant orgId column from membership tables
-- (membership.schema.ts has both tenantId AND orgId — both set to same value;
--  after renaming tenantId → organization_id, orgId becomes a duplicate)
-- ---------------------------------------------------------------------------
ALTER TABLE "membership_category" DROP COLUMN IF EXISTS "org_id";
ALTER TABLE "membership" DROP COLUMN IF EXISTS "org_id";
ALTER TABLE "membership_application" DROP COLUMN IF EXISTS "org_id";
