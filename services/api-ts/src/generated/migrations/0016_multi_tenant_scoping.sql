-- Migration 0016: P0-7 Multi-tenant table scoping
-- Adds organization_id column + index to 5 previously unscoped tables.
-- Column is nullable initially to allow backfill of existing rows,
-- then set NOT NULL after backfill completes.

-- 1. invoice (billing)
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "invoices_org_idx" ON "invoice" ("organization_id");

-- 2. merchant_account (billing)
ALTER TABLE "merchant_account" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "merchant_accounts_org_idx" ON "merchant_account" ("organization_id");

-- 3. chat_room (comms)
ALTER TABLE "chat_room" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "chat_rooms_org_idx" ON "chat_room" ("organization_id");

-- 4. chat_message (comms)
ALTER TABLE "chat_message" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "chat_messages_org_idx" ON "chat_message" ("organization_id");

-- 5. stored_file (storage)
ALTER TABLE "stored_file" ADD COLUMN IF NOT EXISTS "organization_id" uuid;
CREATE INDEX IF NOT EXISTS "stored_files_org_idx" ON "stored_file" ("organization_id");
CREATE INDEX IF NOT EXISTS "stored_files_owner_idx" ON "stored_file" ("owner");

-- After backfill, run:
-- ALTER TABLE "invoice" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "merchant_account" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "chat_room" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "chat_message" ALTER COLUMN "organization_id" SET NOT NULL;
-- ALTER TABLE "stored_file" ALTER COLUMN "organization_id" SET NOT NULL;
