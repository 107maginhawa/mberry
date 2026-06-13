-- [FIX-003 / Batch F] Per-org/year receipt counter + scoped receipt uniqueness.
--
-- Hand-written migration (drizzle-kit generate fails with exit 127 in CI — see
-- 0061_chat_message_reactions.sql for context). Additive + safe:
--
-- 1. Creates `dues_receipt_counter` — an atomic per-(organization, year)
--    sequence source. recordDuesPayment / submitPaymentProof /
--    initiateOnlinePayment claim the next number via
--    `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, which is race-safe
--    (replaces the old `count(*)`-based sequence that could hand out the same
--    number to two concurrent recorders).
--
-- 2. Replaces the GLOBAL `dues_payment_receipt_unique` constraint with a
--    per-org unique index. Combined with the new per-org receipt PREFIX
--    (buildReceiptPrefix), this lets two different orgs each have their own
--    `*-2026-000001` without colliding, while still preventing duplicate
--    receipt numbers WITHIN an org.

CREATE TABLE IF NOT EXISTS "dues_receipt_counter" (
  "organization_id" uuid NOT NULL,
  "year" integer NOT NULL,
  "next_sequence" integer NOT NULL DEFAULT 1,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "dues_receipt_counter_pk" PRIMARY KEY ("organization_id", "year")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "dues_receipt_counter"
    ADD CONSTRAINT "dues_receipt_counter_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Drop the global receipt-number unique constraint (cause of cross-org collision).
DO $$ BEGIN
  ALTER TABLE "dues_payment" DROP CONSTRAINT "dues_payment_receipt_unique";
EXCEPTION WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
-- Re-scope uniqueness to (organization_id, receipt_number).
DO $$ BEGIN
  ALTER TABLE "dues_payment"
    ADD CONSTRAINT "dues_payment_org_receipt_unique"
    UNIQUE ("organization_id", "receipt_number");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
