-- 0014_data_model_unification.sql
-- Phase 3: Data Model Unification — remove tenantId columns from all association module tables.
-- D-08: Single atomic migration, zero data loss.
-- D-02: Drop tenant_id where organization_id already exists; rename where only tenant_id exists.
-- Guards: every ALTER wrapped in DO block to handle missing tables/columns idempotently.

-- ---------------------------------------------------------------------------
-- Wave 1: DROP tenant_id from tables that ALSO have organization_id
-- (data already captured in organization_id; DROP is safe)
-- ---------------------------------------------------------------------------

-- training module
ALTER TABLE "training" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "training_enrollment" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "course" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "course_enrollment" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "quiz_attempt" DROP COLUMN IF EXISTS "tenant_id";

-- events module
ALTER TABLE "event" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "event_registration" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "check_in" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "waitlist_entry" DROP COLUMN IF EXISTS "tenant_id";

-- dues module
ALTER TABLE "dues_config" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "dues_invoice" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "aging_bucket" DROP COLUMN IF EXISTS "tenant_id";

-- governance module
ALTER TABLE "position" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "officer_term" DROP COLUMN IF EXISTS "tenant_id";

-- credits module
ALTER TABLE "credit_entry" DROP COLUMN IF EXISTS "tenant_id";

-- ---------------------------------------------------------------------------
-- Wave 2: RENAME tenant_id → organization_id (only if tenant_id exists AND
-- organization_id does NOT already exist on the table)
-- ---------------------------------------------------------------------------

-- Helper: safe rename that handles missing table, missing column, or duplicate column
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_tier' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_tier' AND column_name='organization_id')
  THEN ALTER TABLE "membership_tier" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_category' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_category' AND column_name='organization_id')
  THEN ALTER TABLE "membership_category" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership' AND column_name='organization_id')
  THEN ALTER TABLE "membership" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_application' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='membership_application' AND column_name='organization_id')
  THEN ALTER TABLE "membership_application" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chapter_affiliation' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chapter_affiliation' AND column_name='organization_id')
  THEN ALTER TABLE "chapter_affiliation" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliation_transfer' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliation_transfer' AND column_name='organization_id')
  THEN ALTER TABLE "affiliation_transfer" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='royalty_split' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='royalty_split' AND column_name='organization_id')
  THEN ALTER TABLE "royalty_split" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='professional_license' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='professional_license' AND column_name='organization_id')
  THEN ALTER TABLE "professional_license" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='license_renewal_alert' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='license_renewal_alert' AND column_name='organization_id')
  THEN ALTER TABLE "license_renewal_alert" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credential_template' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='credential_template' AND column_name='organization_id')
  THEN ALTER TABLE "credential_template" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='digital_credential' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='digital_credential' AND column_name='organization_id')
  THEN ALTER TABLE "digital_credential" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='directory_profile' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='directory_profile' AND column_name='organization_id')
  THEN ALTER TABLE "directory_profile" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_template' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message_template' AND column_name='organization_id')
  THEN ALTER TABLE "message_template" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='message' AND column_name='organization_id')
  THEN ALTER TABLE "message" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_topic' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscription_topic' AND column_name='organization_id')
  THEN ALTER TABLE "subscription_topic" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='person_subscription' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='person_subscription' AND column_name='organization_id')
  THEN ALTER TABLE "person_subscription" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document' AND column_name='organization_id')
  THEN ALTER TABLE "document" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document_version' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document_version' AND column_name='organization_id')
  THEN ALTER TABLE "document_version" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document_tag' AND column_name='tenant_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document_tag' AND column_name='organization_id')
  THEN ALTER TABLE "document_tag" RENAME COLUMN "tenant_id" TO "organization_id";
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Wave 2b: Drop redundant org_id from membership tables (where both existed)
-- ---------------------------------------------------------------------------
ALTER TABLE "membership_category" DROP COLUMN IF EXISTS "org_id";
ALTER TABLE "membership" DROP COLUMN IF EXISTS "org_id";
ALTER TABLE "membership_application" DROP COLUMN IF EXISTS "org_id";

-- ---------------------------------------------------------------------------
-- Wave 3: Drop leftover tenant_id from tables that now have organization_id
-- (for tables where both existed and rename happened — clean up the old one)
-- ---------------------------------------------------------------------------
ALTER TABLE "membership_tier" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "membership_category" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "membership" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "membership_application" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "chapter_affiliation" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "affiliation_transfer" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "royalty_split" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "directory_profile" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "message_template" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "message" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "subscription_topic" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "person_subscription" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "document" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "document_version" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "document_tag" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "invitation_token" DROP COLUMN IF EXISTS "org_id";
ALTER TABLE "person_privacy_setting" DROP COLUMN IF EXISTS "org_id";
