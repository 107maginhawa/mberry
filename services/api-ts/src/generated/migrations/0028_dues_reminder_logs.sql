CREATE TABLE IF NOT EXISTS "dues_reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"schedule_id" uuid,
	"dues_config_id" uuid NOT NULL,
	"period_key" varchar(20) NOT NULL,
	"days_offset" integer NOT NULL,
	"channel" varchar(20) NOT NULL,
	"notification_id" uuid,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_reminder_log_org_idx" ON "dues_reminder_log" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dues_reminder_log_person_idx" ON "dues_reminder_log" USING btree ("person_id");
--> statement-breakpoint
ALTER TABLE "dues_reminder_log" ADD CONSTRAINT "dues_reminder_log_idempotency" UNIQUE("person_id","schedule_id","period_key","days_offset");
