-- 0067: Additive `type` (platform training delivery format) on `training`.
--
-- Batch C (AHA training-credits, FIX-007 / G7a / M9-R1). Hand-written +
-- idempotent (drizzle-kit generate is unavailable in this environment — see
-- 0061..0066 for context). Additive only: new closed-set enum + nullable
-- column + supporting index. No renames, no data backfill required (existing
-- rows keep NULL type).
--
-- The TypeSpec `TrainingType` enum, the createTraining handler, and the
-- searchTrainings repo filter all reference these five values; before this
-- migration the column did not exist, so `type` was accepted by the API,
-- dropped by the handler, and the advertised `?type=` search filter was a
-- silent no-op.

DO $$ BEGIN
  CREATE TYPE "public"."training_type" AS ENUM ('seminar', 'workshop', 'webinar', 'self_paced', 'hands_on');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "training" ADD COLUMN IF NOT EXISTS "type" "public"."training_type";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_training_type" ON "training" USING btree ("type");
