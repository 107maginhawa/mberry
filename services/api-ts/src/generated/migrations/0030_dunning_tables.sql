CREATE TYPE "public"."dunning_channel" AS ENUM('email', 'sms', 'letter');--> statement-breakpoint
CREATE TYPE "public"."dunning_delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."dunning_template_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "dunning_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"membership_id" varchar(255) NOT NULL,
	"person_id" varchar(255) NOT NULL,
	"template_id" varchar(255) NOT NULL,
	"stage" integer NOT NULL,
	"sent_at" timestamp NOT NULL,
	"channel" "dunning_channel" NOT NULL,
	"delivery_status" "dunning_delivery_status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dunning_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" varchar(255) NOT NULL,
	"name" varchar(100) NOT NULL,
	"stage" integer NOT NULL,
	"days_after_due" integer NOT NULL,
	"channel" "dunning_channel" NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"status" "dunning_template_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dunning_event_membership_idx" ON "dunning_event" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "dunning_event_template_idx" ON "dunning_event" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "dunning_event_person_idx" ON "dunning_event" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "dunning_template_org_idx" ON "dunning_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "dunning_template_org_stage_idx" ON "dunning_template" USING btree ("organization_id","stage");--> statement-breakpoint
ALTER TABLE "officer_term" ADD CONSTRAINT "officer_term_date_order" CHECK ("officer_term"."end_date" IS NULL OR "officer_term"."end_date" > "officer_term"."start_date");