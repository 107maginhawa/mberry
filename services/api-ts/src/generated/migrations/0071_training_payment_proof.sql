-- TC-DEC-01 (AHA Step 47) — paid-training PROOF-OF-PAYMENT.
-- Adds the payment_pending holding state to the shared enrollment_status enum
-- and the offline-payment-proof columns to training_enrollment. A paid
-- enrollment is created in payment_pending; the member submits proof and an
-- officer confirms (payment_confirmed_by / payment_confirmed_at) to move it to
-- enrolled. No column defaults to payment_pending, so the new value is not used
-- inside this migration (safe for the ALTER TYPE ADD VALUE constraint).
ALTER TYPE "public"."enrollment_status" ADD VALUE IF NOT EXISTS 'payment_pending';--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "proof_storage_key" varchar(500);--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "proof_file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "proof_mime_type" varchar(100);--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "payment_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "payment_confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD COLUMN IF NOT EXISTS "payment_confirmed_at" timestamp with time zone;
