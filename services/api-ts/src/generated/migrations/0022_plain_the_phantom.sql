ALTER TYPE "public"."dues_payment_status" ADD VALUE 'submitted';--> statement-breakpoint
ALTER TYPE "public"."dues_payment_status" ADD VALUE 'underReview';--> statement-breakpoint
ALTER TYPE "public"."dues_payment_status" ADD VALUE 'confirmed';--> statement-breakpoint
ALTER TYPE "public"."dues_payment_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "dues_payment" ADD COLUMN "proof_storage_key" varchar(500);--> statement-breakpoint
ALTER TABLE "dues_payment" ADD COLUMN "proof_file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "dues_payment" ADD COLUMN "proof_mime_type" varchar(100);--> statement-breakpoint
ALTER TABLE "dues_payment" ADD COLUMN "rejection_reason" text;