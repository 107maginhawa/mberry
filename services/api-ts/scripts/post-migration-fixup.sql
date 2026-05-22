-- Post-migration fixup: adds columns that exist in Drizzle schema but no migration creates.
-- Run AFTER API starts (migrations complete) and BEFORE seed.
-- All statements are idempotent — safe to run multiple times.

-- dues_payment: refund tracking columns
ALTER TABLE "dues_payment" ADD COLUMN IF NOT EXISTS "refund_date" timestamp;
ALTER TABLE "dues_payment" ADD COLUMN IF NOT EXISTS "refund_reason" text;

-- association: credit cycle config
ALTER TABLE "association" ADD COLUMN IF NOT EXISTS "cycle_start_day" integer;
ALTER TABLE "association" ADD COLUMN IF NOT EXISTS "cycle_start_month" integer;

-- audit_log_entry: sub-type for granular event classification
ALTER TABLE "audit_log_entry" ADD COLUMN IF NOT EXISTS "event_sub_type" varchar(255);

-- document: file metadata (may exist from 0019 rename chain, safe to add)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document' AND column_name='file_name')
  THEN ALTER TABLE "document" ADD COLUMN "file_name" varchar(500);
  END IF;
END $$;

-- membership: removed/terminated columns (0038 renames terminated_at→removed_at, but fails if column doesn't exist)
ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;
ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "removal_reason" varchar(500);

-- event: event_type (from 0019 rename of tenant_id→event_type, may not have fired)
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "event_type" varchar(100);

-- document: size column (from 0019 rename chain)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document' AND column_name='size')
  THEN ALTER TABLE "document" ADD COLUMN "size" bigint;
  END IF;
END $$;

-- document_version: storage_key (from 0019 rename chain)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='document_version' AND column_name='storage_key')
  THEN ALTER TABLE "document_version" ADD COLUMN "storage_key" varchar(500);
  END IF;
END $$;

-- Enum value needed by seed: 'removed' in membership_status
DO $$ BEGIN
  ALTER TYPE "membership_status" ADD VALUE 'removed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum values that may be missing: resigned, deceased, expelled
DO $$ BEGIN ALTER TYPE "membership_status" ADD VALUE 'resigned'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "membership_status" ADD VALUE 'deceased'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "membership_status" ADD VALUE 'expelled'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notification type values needed by seed
DO $$ BEGIN ALTER TYPE "notification_type" ADD VALUE 'waitlist.promoted'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "notification_type" ADD VALUE 'event.late-cancellation'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "notification_type" ADD VALUE 'dunning.escalation'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "notification_type" ADD VALUE 'task.overdue'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "notification_type" ADD VALUE 'security'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
