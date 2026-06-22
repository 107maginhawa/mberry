# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# [BR-55][BR-56] Postmark bounce/complaint webhook — auto-suppression wire boundary.
#
# Hand-wired public endpoint (CSRF/auth-exempt) secured by a shared secret over
# HTTP Basic auth. This suite proves the SECURITY BOUNDARY at the wire: the
# webhook rejects missing/forged credentials and accepts a correctly-signed
# bounce/complaint. The persisted-suppression guarantee (which orgs, which
# reason, idempotency) is proven against real PG in
# services/api-ts/src/handlers/email/postmarkWebhook.integration.test.ts.
#
# The Authorization values below are base64("postmark:<secret>"); the secret is
# set as POSTMARK_WEBHOOK_SECRET in the contract CI env (.github/workflows/contract.yml).

# ── 1. Missing credentials → 401 ────────────────────────────
POST {{api}}/webhooks/postmark
x-csrf-token: {{csrf_token}}
Origin: {{origin}}
Content-Type: application/json
{
  "RecordType": "Bounce",
  "Type": "HardBounce",
  "Email": "nobody@example.com"
}
HTTP 401


# ── 2. Forged credentials → 401 ─────────────────────────────
POST {{api}}/webhooks/postmark
x-csrf-token: {{csrf_token}}
Origin: {{origin}}
Authorization: Basic cG9zdG1hcms6d3Jvbmc=
Content-Type: application/json
{
  "RecordType": "Bounce",
  "Type": "HardBounce",
  "Email": "nobody@example.com"
}
HTTP 401


# ── 3. Correctly-signed hard bounce → 200 ───────────────────
POST {{api}}/webhooks/postmark
x-csrf-token: {{csrf_token}}
Origin: {{origin}}
Authorization: Basic cG9zdG1hcms6Y29udHJhY3QtdGVzdC1wb3N0bWFyay1zZWNyZXQtZG8tbm90LXVzZS1pbi1wcm9k
Content-Type: application/json
{
  "RecordType": "Bounce",
  "Type": "HardBounce",
  "Email": "wire-bounce@example.com"
}
HTTP 200
[Asserts]
jsonpath "$.received" == true


# ── 4. Correctly-signed spam complaint → 200 ────────────────
POST {{api}}/webhooks/postmark
x-csrf-token: {{csrf_token}}
Origin: {{origin}}
Authorization: Basic cG9zdG1hcms6Y29udHJhY3QtdGVzdC1wb3N0bWFyay1zZWNyZXQtZG8tbm90LXVzZS1pbi1wcm9k
Content-Type: application/json
{
  "RecordType": "SpamComplaint",
  "Email": "wire-complaint@example.com"
}
HTTP 200
[Asserts]
jsonpath "$.received" == true
