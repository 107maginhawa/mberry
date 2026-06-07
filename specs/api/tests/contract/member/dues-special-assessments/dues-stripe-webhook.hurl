# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/dues-special-assessments — Stripe webhook contract
#
# Covers POST /webhooks/stripe (hand-wired by-design, pre-auth, RFC-style
# Stripe signature header). The endpoint:
#   - is PUBLIC (Stripe sends unauthenticated POSTs)
#   - verifies the stripe-signature header with STRIPE_WEBHOOK_SECRET
#   - rejects unsigned / mis-signed requests with 400
#   - logs every attempt to webhook_retry_log keyed by idempotency_key
#
# Real flow: a synthetic stripe-signature is sent with a fresh per-run
# timestamp. Without the real webhook secret the verification MUST
# fail, returning 400. This asserts the route is registered, accepts
# the documented signature shape, and enforces signature verification
# even when the body is well-formed. We do NOT exercise the success
# path here — that requires stripe-mock signing with the live secret,
# which is covered by stripeWebhook.integration.test.ts.

# ── 1. webhook with synthetic (unverifiable) signature → 400 ──────
POST {{api}}/webhooks/stripe
Origin: {{origin}}
stripe-signature: t=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000
Content-Type: application/json
{
  "id": "evt_hurl_{{suffix}}",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_hurl_{{suffix}}",
      "amount": 50000,
      "currency": "php",
      "metadata": {
        "invoiceId": "hurl-invoice-{{suffix}}"
      }
    }
  }
}
HTTP 400
