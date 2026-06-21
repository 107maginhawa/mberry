-- Enforce the multi-tenant scoping invariant on the notification table.
--
-- notification.schema.ts declares organization_id `.notNull()`, and
-- createNotificationForModule (repo:148) throws ValidationError when org_id is
-- missing — the application contract IS "org_id required". But the column was
-- only ever Drizzle-side `.notNull()` and stayed NULLABLE at the DB layer
-- (0078 tightened invoice + notification_preference, never `notification`). Any
-- write path that bypasses the repo guard could persist a tenant-less
-- notification (cross-tenant leak risk). This closes that schema-vs-DB drift,
-- the same class events Slice 4 fixed with migration 0079.
--
-- The notification table has no parent to backfill org_id from (and every
-- production writer already passes organization_id), so simply delete any
-- residual NULL-org rows (none expected) then SET NOT NULL. Mirrors the 0078/
-- 0079 guarded pattern so the migration applies cleanly even if NULL rows exist.
DELETE FROM "notification" WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "notification" ALTER COLUMN "organization_id" SET NOT NULL;
