-- Rename 'terminated' → 'removed' in membership_status enum (BR-03 terminology alignment)
-- Uses ALTER TYPE ... RENAME VALUE (PostgreSQL 10+) — no data loss, no rewrite.
ALTER TYPE "membership_status" RENAME VALUE 'terminated' TO 'removed';

-- Rename columns in membership table
ALTER TABLE "membership" RENAME COLUMN "terminated_at" TO "removed_at";
ALTER TABLE "membership" RENAME COLUMN "termination_reason" TO "removal_reason";
