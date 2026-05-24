-- Wave 2a S1: Event schema extension
-- Add CPD activity type enum, event slug (globally unique), cover image URL

-- Step 1: Create cpd_activity_type enum
DO $$ BEGIN
  CREATE TYPE "public"."cpd_activity_type" AS ENUM(
    'seminar', 'workshop', 'conference', 'webinar', 'hands_on',
    'community', 'research', 'mentorship', 'self_directed', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add new columns to event table (all nullable — non-breaking for existing rows)
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "cpd_activity_type" "cpd_activity_type";
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "event_slug" varchar(300);
ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "cover_image_url" varchar(2048);

-- Step 3: Add unique constraint on event_slug
ALTER TABLE "event" ADD CONSTRAINT "event_event_slug_unique" UNIQUE ("event_slug");

-- Step 4: Add index for slug lookups
CREATE INDEX IF NOT EXISTS "idx_event_slug" ON "event" ("event_slug");
