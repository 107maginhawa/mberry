CREATE TYPE "public"."email_category" AS ENUM('bulk', 'transactional');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('hard_bounce', 'unsubscribe', 'complaint', 'manual');--> statement-breakpoint
CREATE TABLE "email_suppression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"reason" "suppression_reason" NOT NULL,
	"suppressed_at" timestamp DEFAULT now() NOT NULL,
	"suppressed_by" uuid,
	"notes" text,
	CONSTRAINT "email_suppression_org_email_unique" UNIQUE("organization_id","email")
);
--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "email_category" "email_category" DEFAULT 'transactional' NOT NULL;--> statement-breakpoint
CREATE INDEX "email_suppression_org_email_idx" ON "email_suppression" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "email_suppression_email_idx" ON "email_suppression" USING btree ("email");