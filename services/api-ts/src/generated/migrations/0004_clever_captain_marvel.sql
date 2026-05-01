CREATE TYPE "public"."position_level" AS ENUM('national', 'regional', 'chapter');--> statement-breakpoint
CREATE TYPE "public"."term_status" AS ENUM('upcoming', 'active', 'completed', 'resigned', 'removed');--> statement-breakpoint
CREATE TABLE "officer_term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "term_status" DEFAULT 'upcoming' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "position" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"level" "position_level" NOT NULL,
	"term_length_months" integer DEFAULT 12 NOT NULL,
	"max_terms" integer,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX "idx_officer_term_org" ON "officer_term" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_officer_term_person" ON "officer_term" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_officer_term_position" ON "officer_term" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_officer_term_tenant" ON "officer_term" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_position_org" ON "position" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_position_tenant" ON "position" USING btree ("tenant_id");