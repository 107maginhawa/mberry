-- Migration 0017: P1 Multi-tenant table scoping
-- Adds organization_id column + index to 10 P1 tables.
-- Column is nullable initially to allow backfill of existing rows.

-- 1. notification_preference (person)
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "notif_pref_org_idx" ON "notification_preference" ("organization_id");

-- 2. invoice_line_item (billing) — defense-in-depth, parent invoice already scoped
ALTER TABLE "invoice_line_item" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "invoice_line_items_org_idx" ON "invoice_line_item" ("organization_id");

-- 3. booking_event (booking)
ALTER TABLE "booking_event" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "booking_events_org_idx" ON "booking_event" ("organization_id");

-- 4. time_slot (booking)
ALTER TABLE "time_slot" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "time_slots_org_idx" ON "time_slot" ("organization_id");

-- 5. booking (booking)
ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "bookings_org_idx" ON "booking" ("organization_id");

-- 6. schedule_exception (booking)
ALTER TABLE "schedule_exception" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "schedule_exceptions_org_idx" ON "schedule_exception" ("organization_id");

-- 7. email_template (email)
ALTER TABLE "email_template" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "email_template_org_idx" ON "email_template" ("organization_id");

-- 8. email_queue (email)
ALTER TABLE "email_queue" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "email_queue_org_idx" ON "email_queue" ("organization_id");

-- 9. notification (notifs)
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "notifications_org_idx" ON "notification" ("organization_id");

-- Note: person_privacy_setting already has org_id. stored_file done in 0016.

-- After backfill, run:
-- ALTER TABLE "notification_preference" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "invoice_line_item" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "booking_event" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "time_slot" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "booking" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "schedule_exception" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "email_template" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "email_queue" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "notification" ALTER COLUMN "organization_id" SET NOT NULL;
