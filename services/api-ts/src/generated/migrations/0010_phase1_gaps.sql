-- Phase 1 gaps: org slug, privacy settings, notification preferences

-- 1. Add slug column to organization table
ALTER TABLE "organization" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_org_slug" ON "organization" USING btree ("slug");--> statement-breakpoint

-- 2. Person privacy settings (per person per org)
CREATE TABLE "person_privacy_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"person_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"email_visible" boolean DEFAULT false NOT NULL,
	"phone_visible" boolean DEFAULT false NOT NULL,
	"photo_visible" boolean DEFAULT true NOT NULL,
	"address_visible" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_person_org_idx" ON "person_privacy_setting" USING btree ("person_id","org_id");--> statement-breakpoint
CREATE INDEX "privacy_person_idx" ON "person_privacy_setting" USING btree ("person_id");--> statement-breakpoint

-- 3. Notification preferences (per person per category)
CREATE TABLE "notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"person_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "notif_pref_person_category_idx" ON "notification_preference" USING btree ("person_id","category");--> statement-breakpoint
CREATE INDEX "notif_pref_person_idx" ON "notification_preference" USING btree ("person_id");
