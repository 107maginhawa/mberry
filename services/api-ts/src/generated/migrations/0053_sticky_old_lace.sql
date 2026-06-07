DO $$ BEGIN CREATE TYPE "public"."breach_status" AS ENUM('reported', 'investigating', 'notified', 'resolved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "breach_incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"reported_by" uuid NOT NULL,
	"discovered_at" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"affected_records_count" integer,
	"data_categories" jsonb,
	"notification_deadline" timestamp with time zone NOT NULL,
	"status" "breach_status" DEFAULT 'reported' NOT NULL,
	"notified_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"npc_reference_number" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_event_parent";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN IF EXISTS "parent_event_id";