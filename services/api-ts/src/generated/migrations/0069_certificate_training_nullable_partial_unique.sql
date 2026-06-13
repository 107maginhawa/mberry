-- 0069: Certificate trainingId nullable + partial unique + certificate_type.
--
-- AHA Documents & Credentials, Batch F (Q8 = Option A, Step 38). Hand-written
-- + idempotent (drizzle-kit generate is unavailable in this environment — see
-- 0061..0068 for context). Data-safe: pre-launch pilot, so the only existing
-- certificate rows are seed/test data with the bogus trainingId == organizationId
-- self-reference; no distributed printed artifacts.
--
-- ROOT CAUSE (FIX-006/G6): bulkIssueCertificates stored trainingId = organizationId
-- (the bulk body never carried a trainingId). The old UNIQUE constraint on
-- (training_id, person_id) therefore collapsed to (org_id, person_id) → at most
-- ONE bulk certificate per person per org, ever. This migration:
--   1. makes training_id NULLable,
--   2. NULLs out the bogus self-reference rows,
--   3. drops the old full UNIQUE constraint,
--   4. recreates uniqueness as a PARTIAL unique index WHERE training_id IS NOT NULL
--      (so unlinked/historical certs coexist; real-training dupes still reject),
--   5. adds certificate_type so the PDF (FIX-005) resolves the kind server-side
--      instead of trusting a client body override.
-- All statements are idempotent and safe to re-run.

-- 1. training_id becomes nullable.
ALTER TABLE "certificate" ALTER COLUMN "training_id" DROP NOT NULL;

-- 2. NULL out bogus self-reference rows (training_id == organization_id).
UPDATE "certificate" SET "training_id" = NULL WHERE "training_id" = "organization_id";

-- 3. Drop the old full UNIQUE constraint (frees the name for the partial index).
ALTER TABLE "certificate" DROP CONSTRAINT IF EXISTS "certificate_training_person_unique";

-- 4. Partial unique index: one cert per (training, person) among LINKED rows only.
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_training_person_unique"
  ON "certificate" USING btree ("training_id", "person_id")
  WHERE "training_id" IS NOT NULL;

-- 5. Persist the certificate kind (attendance/completion/speaker).
ALTER TABLE "certificate" ADD COLUMN IF NOT EXISTS "certificate_type" varchar(20);
