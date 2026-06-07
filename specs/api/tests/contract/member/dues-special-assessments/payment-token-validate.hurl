# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/dues-special-assessments — public payment-token validate path
#
# Covers operationId: validatePaymentToken (public, no auth).
# Real flow: anonymous client probes a known-invalid token. The endpoint
# is intentionally PUBLIC (no @useAuth on PaymentTokenEndpoints) so the
# request must succeed at the routing layer with no cookies / no CSRF /
# no x-org-id, then return a structured "invalid token" payload (the
# handler distinguishes invalid format, expired, used). We assert
# routing + envelope, not Stripe-mock state — checkout flow requires
# a real signed token which only sendPaymentLink can mint.

# ── 1. validatePaymentToken (public) → 200, structured payload ─────
GET {{api}}/pay/hurl-invalid-token-{{suffix}}/validate
HTTP 200
[Asserts]
jsonpath "$.valid" == false
jsonpath "$.error" exists
