-- Enforce the multi-tenant scoping invariant on the stored_file table.
--
-- file.schema.ts:23 declares organization_id `.notNull()` (comment: "P0-7: file
-- isolation between orgs"), and the only production writer — uploadFile.ts:103-117
-- — reads organization_id from ctx and always passes it (the seed writer does too,
-- layer-4-cross-module.ts:662). But the column was only ever Drizzle-side
-- `.notNull()` and stayed NULLABLE at the DB layer (0078 tightened invoice +
-- notification_preference; 0079 events; 0080 notification — stored_file was never
-- covered). A missing org header on the upload path would persist a tenant-less
-- file row today (cross-tenant exposure). This closes that schema-vs-DB drift, the
-- same class events Slice 4 fixed with migration 0079.
--
-- The stored_file table has no parent to backfill org_id from (and every
-- production/seed writer already passes organization_id; live prod has 0 NULL-org
-- rows), so simply delete any residual NULL-org rows (none expected) then SET NOT
-- NULL. Mirrors the 0079/0080 guarded pattern so the migration applies cleanly
-- even if NULL rows exist.
DELETE FROM "stored_file" WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "stored_file" ALTER COLUMN "organization_id" SET NOT NULL;
