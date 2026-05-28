ALTER TABLE "dues_gateway_config" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "billing_config" ALTER COLUMN "provider" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "billing_config" ALTER COLUMN "provider" SET DEFAULT 'stripe'::text;--> statement-breakpoint
DROP TYPE "public"."gateway_provider";--> statement-breakpoint
CREATE TYPE "public"."gateway_provider" AS ENUM('paymongo', 'stripe');--> statement-breakpoint
ALTER TABLE "dues_gateway_config" ALTER COLUMN "provider" SET DATA TYPE "public"."gateway_provider" USING "provider"::"public"."gateway_provider";--> statement-breakpoint
ALTER TABLE "billing_config" ALTER COLUMN "provider" SET DEFAULT 'stripe'::"public"."gateway_provider";--> statement-breakpoint
ALTER TABLE "billing_config" ALTER COLUMN "provider" SET DATA TYPE "public"."gateway_provider" USING "provider"::"public"."gateway_provider";--> statement-breakpoint
CREATE INDEX "idx_invite_person_id" ON "invitation_token" USING btree ("person_id");