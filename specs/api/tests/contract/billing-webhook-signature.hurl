# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# [BR-62] Stripe webhook signature verification — wire rejection boundary.
#
# p0-security. handleStripeWebhook (hand-wired POST /webhooks/stripe) verifies
# the Stripe signature before doing anything; the signature check was backend-
# tested only, with no contract proof that a forged or missing signature is
# rejected at the wire. This suite asserts exactly that: an unsigned and a
# forged webhook are both rejected with 400 before any processing.
#
# The correctly-signed → 200 path requires a live HMAC over (timestamp.payload)
# with STRIPE_WEBHOOK_SECRET — not expressible in static Hurl — and is covered by
# the backend handler test + the stripe-mock billing-lifecycle.hurl flow. The
# SECURITY guarantee here is the rejection of forged/unsigned events.

# ── 1. Missing signature → 400 ──────────────────────────────
POST {{api}}/webhooks/stripe
x-csrf-token: {{csrf_token}}
Origin: {{origin}}
Content-Type: application/json
{
  "id": "evt_contract_test",
  "type": "payment_intent.succeeded",
  "data": { "object": {} }
}
HTTP 400


# ── 2. Forged signature → 400 ───────────────────────────────
POST {{api}}/webhooks/stripe
x-csrf-token: {{csrf_token}}
Origin: {{origin}}
Stripe-Signature: t=1700000000,v1=deadbeefforgerynotavalidhmacsignature
Content-Type: application/json
{
  "id": "evt_contract_test",
  "type": "payment_intent.succeeded",
  "data": { "object": {} }
}
HTTP 400
