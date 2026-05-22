DO $$ BEGIN
ALTER TYPE "public"."audit_action" ADD VALUE 'resign';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
ALTER TYPE "public"."audit_action" ADD VALUE 'deceased';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;