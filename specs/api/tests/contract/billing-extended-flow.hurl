# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Extended billing endpoints not covered by billing.hurl.
# Covers single invoice CRUD, capture/refund/void, merchant dashboard,
# and Stripe webhook. Most operations require Stripe test keys.

# ── Auth ─────────────────────────────────────────────────────

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "bill-ext-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Billing Extended"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "firstName": "BillExt",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# ── 1. Create an invoice to work with ───────────────────────

POST {{api}}/billing/invoices
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "description": "Contract test invoice {{suffix}}",
  "amount": 5000,
  "currency": "usd"
}
HTTP *
[Captures]
invoice_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300


# ── 2. Get single invoice ───────────────────────────────────

GET {{api}}/billing/invoices/{{invoice_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 3. Update invoice ───────────────────────────────────────

PATCH {{api}}/billing/invoices/{{invoice_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "description": "Updated contract test invoice {{suffix}}"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 4. Capture invoice ──────────────────────────────────────
# PREREQUISITE: Requires Stripe test keys

POST {{api}}/billing/invoices/{{invoice_id}}/capture
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *


# ── 5. Refund invoice ───────────────────────────────────────
# PREREQUISITE: Requires Stripe test keys and captured payment

POST {{api}}/billing/invoices/{{invoice_id}}/refund
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *


# ── 6. Void invoice ─────────────────────────────────────────

POST {{api}}/billing/invoices/{{invoice_id}}/void
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *


# ── 7. Delete invoice ───────────────────────────────────────

DELETE {{api}}/billing/invoices/{{invoice_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
HTTP *


# ── 8. Merchant dashboard link ──────────────────────────────
# PREREQUISITE: Requires Stripe test keys and a merchant account
# Using a placeholder ID; real tests need a seeded merchant account.

POST {{api}}/billing/merchant-accounts/00000000-0000-0000-0000-000000000000/dashboard
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *


# ── 9. Stripe webhook ───────────────────────────────────────
# PREREQUISITE: Requires Stripe webhook secret

POST {{api}}/billing/webhooks/stripe
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "type": "invoice.paid",
  "data": { "object": {} }
}
HTTP *
