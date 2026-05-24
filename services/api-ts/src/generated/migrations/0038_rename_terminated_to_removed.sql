-- Rename 'terminated' → 'removed' in membership_status enum (BR-03 terminology alignment)
-- Already applied; kept as no-op for journal consistency.
-- Original: ALTER TYPE "membership_status" RENAME VALUE 'terminated' TO 'removed';
-- Original: ALTER TABLE "membership" RENAME COLUMN "terminated_at" TO "removed_at";
-- Original: ALTER TABLE "membership" RENAME COLUMN "termination_reason" TO "removal_reason";
SELECT 1;
