DO $$ BEGIN
ALTER TYPE "public"."membership_status" ADD VALUE 'resigned';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TYPE "public"."membership_status" ADD VALUE 'deceased';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TYPE "public"."membership_status" ADD VALUE 'expelled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TABLE "membership" ADD COLUMN "date_of_death" date;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;