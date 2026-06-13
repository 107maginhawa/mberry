-- 0065: Additive `resigned_at` on `membership` + backfill from `removed_at`.
--
-- Batch F (AHA membership-lifecycle, database-schema-audit R-5 / FIX-007 schema
-- side). Hand-written + idempotent (drizzle-kit generate is unavailable in this
-- environment — see 0061..0064 for context). Additive only: no renames, no
-- index change, no enum change.
--
-- 1. Adds the nullable `resigned_at` timestamp. computeMembershipStatus already
--    reads `resignedAt` at a higher priority than `removed`; the column lets a
--    resignation survive a status recompute as `resigned` instead of decaying
--    to `removed` (the pre-fix resign handler wrote removed_at).
-- 2. Backfills `resigned_at` from `removed_at` for rows the pre-fix resign
--    handler left behind (status='resigned' + removed_at set). Guarded by
--    `resigned_at IS NULL` so re-runs are no-ops; a no-op as well for resigned
--    rows that never carried a removed_at and for every non-resigned row.

ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "resigned_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "membership"
SET "resigned_at" = "removed_at"
WHERE "status" = 'resigned' AND "resigned_at" IS NULL;
