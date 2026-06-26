-- slice-1: additive only. Pre-existing feed/survey table-drop drift (commit c323bd73) intentionally excluded — deferred to a separate cleanup migration.
ALTER TABLE "dues_gateway_config" ADD COLUMN "encrypted_webhook_secret" text;--> statement-breakpoint
ALTER TABLE "dues_invoice" ADD COLUMN "currency" varchar(3) DEFAULT 'PHP' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_token" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_token" ADD COLUMN "paymongo_session_id" varchar(255);--> statement-breakpoint
ALTER TABLE "payment_token" ADD COLUMN "checkout_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_token" ADD COLUMN "idempotency_key" varchar(255);