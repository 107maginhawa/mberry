-- 0072: Default `membership.joined_at` to now().
--
-- Hand-written + idempotent (drizzle-kit generate is unavailable in this
-- environment — see 0061..0071). Additive only: sets a column DEFAULT, no
-- renames / index / enum changes, no data rewrite.
--
-- `joined_at` is NOT NULL with no DEFAULT. Every first-class membership-creation
-- handler (createMembership, approveMembershipApplication, claimInvite) sets it
-- explicitly, but a rarer insert path can omit it and hit
-- `null value in column "joined_at" of relation "membership" violates not-null
-- constraint` (observed in CI). Defaulting to now() — consistent with the
-- `joined_at` columns on event / comms participants
-- (`.notNull().defaultNow()`) — makes any omitting insert safe and leaves every
-- existing explicit-value insert unchanged. `SET DEFAULT` is naturally
-- idempotent, so re-running is a no-op.

ALTER TABLE "membership" ALTER COLUMN "joined_at" SET DEFAULT now();
