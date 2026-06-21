-- Enforce the multi-tenant scoping invariant on the events tables.
--
-- events.schema.ts declares organization_id `.notNull()` on event_registration
-- and check_in, but only `event` was ever tightened at the DB layer — both child
-- tables were added nullable in 0019 and never enforced (0078 only covered
-- invoice + notification_preference). This closes that schema-vs-DB drift.
--
-- Backfill NULL org_id from the parent event first (the real, recoverable rows),
-- then delete any residual orphans (rows whose parent event no longer exists —
-- unrecoverable junk), then SET NOT NULL. Mirrors the 0078 guarded pattern so the
-- migration applies cleanly even if NULL rows exist in prod.
UPDATE "event_registration" "er"
  SET "organization_id" = "e"."organization_id"
  FROM "event" "e"
  WHERE "er"."event_id" = "e"."id" AND "er"."organization_id" IS NULL;--> statement-breakpoint
DELETE FROM "event_registration" WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "event_registration" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
UPDATE "check_in" "ci"
  SET "organization_id" = "e"."organization_id"
  FROM "event" "e"
  WHERE "ci"."event_id" = "e"."id" AND "ci"."organization_id" IS NULL;--> statement-breakpoint
DELETE FROM "check_in" WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "check_in" ALTER COLUMN "organization_id" SET NOT NULL;
