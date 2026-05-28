CREATE TYPE "public"."seat_allocation_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TABLE "institutional_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"organization_id" uuid NOT NULL,
	"parent_organization_id" uuid NOT NULL,
	"tier_id" uuid NOT NULL,
	"total_seats" integer NOT NULL,
	"used_seats" integer DEFAULT 0 NOT NULL,
	"primary_contact_id" uuid NOT NULL,
	"billing_contact_id" uuid,
	"start_date" date NOT NULL,
	"dues_expiry_date" date,
	"status" "membership_status" DEFAULT 'pendingPayment' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"institutional_membership_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"allocated_by" uuid NOT NULL,
	"allocated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"status" "seat_allocation_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seat_allocation" ADD CONSTRAINT "seat_allocation_institutional_membership_id_institutional_membership_id_fk" FOREIGN KEY ("institutional_membership_id") REFERENCES "public"."institutional_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "institutional_membership_org_idx" ON "institutional_membership" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "institutional_membership_parent_org_idx" ON "institutional_membership" USING btree ("parent_organization_id");--> statement-breakpoint
CREATE INDEX "institutional_membership_status_idx" ON "institutional_membership" USING btree ("status");--> statement-breakpoint
CREATE INDEX "seat_allocation_membership_idx" ON "seat_allocation" USING btree ("institutional_membership_id");--> statement-breakpoint
CREATE INDEX "seat_allocation_person_idx" ON "seat_allocation" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seat_allocation_active_unique" ON "seat_allocation" USING btree ("institutional_membership_id","person_id");