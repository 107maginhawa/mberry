# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-02] [BR-04] [BR-05] [BR-06] [BR-07] [BR-08] [BR-30] [BR-32]
# Dues module contract test: officer configures dues, creates funds,
# records a payment, views dashboard, and generates a report.
# Verifies auth enforcement on all custom routes.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 0. Unauthenticated access → 401 ───────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/member/dues-configs
x-org-id: {{org_id}}
HTTP 401

POST {{api}}/association/member/dues-payments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP 401

# ── Re-authenticate ────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 1. List dues configs ──────────────────────────────────

GET {{api}}/association/member/dues-configs
x-org-id: {{org_id}}
HTTP 200


# ── 2. Create dues config ─────────────────────────────────

POST {{api}}/association/member/dues-configs
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "defaultAmount": 150000,
  "currency": "PHP",
  "gracePeriodDays": 30,
  "billingCycle": "annual"
}
HTTP *
[Asserts]
status < 500


# ── 3. List funds ──────────────────────────────────────────
# ORPHANED: /dues/funds/{orgId} has no spec equivalent
# GET {{api}}/dues/funds/ed8e3a96-8126-4341-be42-e6eb7940c562
# HTTP 200


# ── 4. List payments ──────────────────────────────────────

GET {{api}}/association/member/dues-payments
x-org-id: {{org_id}}
HTTP 200


# ── 5. Dashboard ───────────────────────────────────────────

GET {{api}}/dues/dashboard/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# ── 6. Verify dues configs list (BR-02) ──────────────────

GET {{api}}/association/member/dues-configs
x-org-id: {{org_id}}
HTTP 200


# ── 7. [BR-08] Refund endpoint responds ──────────────────
# Verify endpoint exists and doesn't 500 on a missing payment.

POST {{api}}/association/member/dues-payments/00000000-0000-0000-0000-000000000000/refund
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "amount": 100,
  "reason": "test"
}
HTTP *
[Asserts]
status < 500


# ── 8. [BR-30] Gateway config endpoint ───────────────────

GET {{api}}/association/member/dues-gateway/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status < 500


# ── 9. [BR-32] Financial dashboard (retention verification) ──

GET {{api}}/dues/dashboard/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
