-- [FIX-002 / Batch A] Indexed JSONB lookups for Stripe webhook invoice correlation.
--
-- Hand-written migration (drizzle-kit generate fails with exit 127 in CI — see
-- 0061_chat_message_reactions.sql / 0062_dues_receipt_counter.sql for context;
-- expression indexes on JSONB are not auto-generated reliably anyway). Additive
-- + safe (CREATE INDEX IF NOT EXISTS, no data change).
--
-- The Stripe webhook handlers used to correlate invoices with
-- `InvoiceRepository.findAll()` (`limit(500)`) + an in-memory metadata filter.
-- Once more than 500 invoices existed, charge.succeeded/failed/refunded and
-- transfer.* events SILENTLY failed to find the invoice — money captured by
-- Stripe, invoice never marked paid, Stripe still received a 200 OK.
--
-- The handlers now use indexed predicate lookups:
--   InvoiceRepository.findByStripePaymentIntentId(id)
--   InvoiceRepository.findByStripeTransferId(id)
-- which query `metadata->>'stripePaymentIntentId'` / `metadata->>'stripeTransferId'`.
-- These B-tree expression indexes back those lookups so correlation is O(log n)
-- at any scale (the predicates are equality on a text extraction, so a plain
-- expression index is the right choice — GIN is for containment, not `->>`).

CREATE INDEX IF NOT EXISTS "invoices_metadata_payment_intent_idx"
  ON "invoice" (("metadata"->>'stripePaymentIntentId'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_metadata_transfer_idx"
  ON "invoice" (("metadata"->>'stripeTransferId'));
