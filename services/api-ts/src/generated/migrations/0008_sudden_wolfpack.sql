CREATE TYPE "public"."credit_entry_type" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TABLE "credit_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "credit_entry_type" NOT NULL,
	"training_id" uuid,
	"activity_name" varchar(300) NOT NULL,
	"provider" varchar(300),
	"activity_date" timestamp NOT NULL,
	"credit_amount" integer NOT NULL,
	"cycle_start" timestamp NOT NULL,
	"cycle_end" timestamp NOT NULL,
	"supporting_document_id" uuid
);
--> statement-breakpoint
CREATE INDEX "idx_credit_person" ON "credit_entry" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_credit_org" ON "credit_entry" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_credit_tenant" ON "credit_entry" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_credit_cycle" ON "credit_entry" USING btree ("person_id","cycle_start","cycle_end");--> statement-breakpoint
CREATE INDEX "idx_credit_training" ON "credit_entry" USING btree ("training_id");