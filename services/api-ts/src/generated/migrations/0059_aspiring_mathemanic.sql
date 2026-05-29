CREATE TYPE "public"."data_export_status" AS ENUM('requested', 'processing', 'ready', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "data_export" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"person_id" uuid NOT NULL,
	"status" "data_export_status" DEFAULT 'requested' NOT NULL,
	"download_url" text,
	"expires_at" timestamp with time zone,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
CREATE INDEX "data_export_person_idx" ON "data_export" USING btree ("person_id","requested_at");