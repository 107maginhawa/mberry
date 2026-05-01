CREATE TYPE "public"."document_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "document_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"document_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"accessed_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "document_tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7)
);
--> statement-breakpoint
CREATE TABLE "document_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"file_name" varchar(300) NOT NULL,
	"file_size" bigint,
	"mime_type" varchar(100),
	"uploaded_by" uuid NOT NULL,
	"change_note" text
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"tenant_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"category" varchar(100),
	"document_status" "document_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" uuid,
	"tags" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE INDEX "idx_docaccess_document" ON "document_access_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_docaccess_person" ON "document_access_log" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_doctag_tenant" ON "document_tag" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_docver_document" ON "document_version" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_doc_tenant" ON "document" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_doc_org" ON "document" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_doc_status" ON "document" USING btree ("document_status");