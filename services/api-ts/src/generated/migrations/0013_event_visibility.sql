-- BR-16: Add visibility column to events table
DO $$ BEGIN
  CREATE TYPE "event_visibility" AS ENUM ('internal', 'network');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "event" ADD COLUMN IF NOT EXISTS "visibility" "event_visibility" NOT NULL DEFAULT 'internal';
