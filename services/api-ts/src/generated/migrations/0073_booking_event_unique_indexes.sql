-- 0073: Partial unique indexes backing the P0 concurrency fixes for
-- double-booking and event-registration overflow/duplication.
--
-- Hand-written + idempotent (drizzle-kit generate is unavailable in this
-- environment — snapshots are sparse, see 0061..0072). These indexes are
-- declared in the Drizzle schema (booking.schema.ts activeSlotUniqueIdx;
-- events.schema.ts uq_event_reg_active) but had no migration emitted, so the
-- atomic claim + 23505-catch handlers (createBooking, registerAtomic) lacked
-- their DB-level backstop in any migrated database. This migration adds it.
--
-- Both are PARTIAL unique indexes so that a cancelled/rejected/refunded row
-- frees the slot/seat for a legitimate re-book / re-register (mirrors the
-- partial-index pattern established in 0069).
--
-- Data assumption: pre-launch pilot — no pre-existing *active* duplicates
-- (the old code could create them, but the seed/pilot data set is clean).
-- If a target DB does hold active duplicates, index creation fails LOUDLY by
-- design, surfacing the duplicate to resolve deliberately rather than guessing
-- which row to drop. `IF NOT EXISTS` keeps re-runs a no-op.

-- 1. Double-booking guard: at most one ACTIVE (pending|confirmed) booking per
--    time slot. A cancelled/rejected booking does NOT block re-booking.
-- migration-safety: reviewed — non-CONCURRENT by necessity (drizzle runs
-- migrations in a transaction; CREATE INDEX CONCURRENTLY cannot run in one).
-- Pre-launch pilot: `booking` holds only seed/test rows, so the brief lock is
-- negligible. Rollback: DROP INDEX "bookings_active_slot_unique".
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_active_slot_unique"
  ON "booking" USING btree ("slot_id")
  WHERE "status" IN ('pending', 'confirmed');

-- 2. Event-registration guard: at most one ACTIVE registration per
--    (event, person). A cancelled/refunded registration allows re-registration;
--    a duplicate active row rejects with 23505 → "already registered".
-- migration-safety: reviewed — same rationale as index 1 (non-CONCURRENT under
-- the transactional migrator; pre-launch small table). Rollback: DROP INDEX
-- "uq_event_reg_active".
CREATE UNIQUE INDEX IF NOT EXISTS "uq_event_reg_active"
  ON "event_registration" USING btree ("event_id", "person_id")
  WHERE "status" NOT IN ('cancelled', 'refunded');
