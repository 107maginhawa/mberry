CREATE TYPE "public"."training_visibility" AS ENUM('internal', 'network');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('billing', 'technical', 'membership', 'general');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'standard', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');--> statement-breakpoint
CREATE TABLE "support_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"reported_by" uuid NOT NULL,
	"assigned_to" uuid,
	"subject" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" "ticket_category" DEFAULT 'general' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'standard' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"sla_first_response_deadline" timestamp with time zone NOT NULL,
	"sla_resolution_deadline" timestamp with time zone NOT NULL,
	"first_responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "training" ADD COLUMN "visibility" "training_visibility" DEFAULT 'network' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_comment" ADD CONSTRAINT "ticket_comment_ticket_id_support_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_ticket"("id") ON DELETE no action ON UPDATE no action;