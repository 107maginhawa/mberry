-- 0068: Partial unique index on training_enrollment (training_id, person_id)
--       for ACTIVE (non-cancelled) enrollments.
--
-- Batch D (AHA training-credits, FIX-010 / G10). Hand-written + idempotent
-- (drizzle-kit generate is unavailable in this environment — see 0061..0067
-- for context). Additive only: one partial unique index. No data backfill.
--
-- A member may hold at most ONE active enrollment per training. The handler
-- (enrollInCustomTraining) already pre-checks, but this index is the DB
-- backstop that prevents duplicate live rows under a race. A previously
-- cancelled enrollment is excluded from the constraint, so re-enrollment
-- after cancelling is still permitted.
--
-- NOTE: if existing data already contains duplicate active enrollments for
-- the same (training_id, person_id), CREATE UNIQUE INDEX would fail. The
-- idempotent de-dup PREFLIGHT below runs FIRST so a boot against dirty data
-- cannot crash the migrator (AHA Step 27). Per (training_id, person_id), among
-- NON-cancelled rows it keeps exactly ONE winner and soft-cancels the losers
-- (status='cancelled' + cancelled_at=now(); never DELETE — preserves audit and
-- any earned credit). Winner priority, most-progressed first so no completion
-- is ever cancelled: completed > enrolled > noShow; tie-break earliest
-- enrolled_at; final tie-break smallest id. Both statements are idempotent —
-- re-running cancels nothing once one winner per group remains.

-- PREFLIGHT (de-dup before the index; safe to re-run):
UPDATE "training_enrollment"
SET "status" = 'cancelled', "cancelled_at" = now()
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (
      PARTITION BY "training_id", "person_id"
      ORDER BY ("status" = 'completed') DESC, ("status" = 'enrolled') DESC, "enrolled_at" ASC, "id" ASC
    ) AS rn
    FROM "training_enrollment"
    WHERE "status" <> 'cancelled'
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_training_enroll_active"
  ON "training_enrollment" USING btree ("training_id", "person_id")
  WHERE "status" <> 'cancelled';
