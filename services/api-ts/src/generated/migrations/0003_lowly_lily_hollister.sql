CREATE TYPE "public"."invite_status" AS ENUM('pending', 'claimed', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."invite_type" AS ENUM('claim', 'invite');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'approve';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'deny';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'renew';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'terminate';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'reinstate';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'mark-paid';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'complete';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'transfer';--> statement-breakpoint
ALTER TYPE "public"."audit_category" ADD VALUE 'association';--> statement-breakpoint
CREATE TABLE "invitation_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"person_id" uuid,
	"org_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"type" "invite_type" NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"claimed_at" timestamp,
	"created_by_officer" uuid NOT NULL,
	"metadata" jsonb,
	"email" varchar(255) NOT NULL,
	"message" varchar(1000),
	CONSTRAINT "invitation_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX "idx_invite_token_hash" ON "invitation_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_invite_org" ON "invitation_token" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_invite_email" ON "invitation_token" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_invite_status" ON "invitation_token" USING btree ("status");