CREATE TYPE "public"."comm_channel" AS ENUM('email', 'push', 'inApp', 'sms');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'bounced');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE "message_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"channel" "comm_channel" NOT NULL,
	"subject" varchar(500),
	"body" text NOT NULL,
	"merge_fields" jsonb DEFAULT '[]'::jsonb,
	"category" varchar(100) NOT NULL,
	"is_transactional" boolean DEFAULT false NOT NULL,
	"status" "template_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"template_id" uuid,
	"channel" "comm_channel" NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb,
	"subject" varchar(500),
	"body" text NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"status" "message_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_topic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"channel" "comm_channel" NOT NULL,
	"category" varchar(100) NOT NULL,
	"default_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_msg_template_tenant" ON "message_template" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_msg_template_category" ON "message_template" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_message_tenant" ON "message" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_message_status" ON "message" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_message_sender" ON "message" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_person_sub_person" ON "person_subscription" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_person_sub_unique" ON "person_subscription" USING btree ("person_id","topic_id");--> statement-breakpoint
CREATE INDEX "idx_sub_topic_tenant" ON "subscription_topic" USING btree ("tenant_id");