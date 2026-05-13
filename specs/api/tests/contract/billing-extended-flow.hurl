# Extended billing endpoints not covered by billing.hurl.
# Covers single invoice CRUD, capture/refund/void, merchant dashboard,
# and Stripe webhook. Most operations require Stripe test keys.

# ── Auth ─────────────────────────────────────────────────────

POST {{api}}/auth/sign-up/email
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
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *


# ── 5. Refund invoice ───────────────────────────────────────
# PREREQUISITE: Requires Stripe test keys and captured payment

POST {{api}}/billing/invoices/{{invoice_id}}/refund
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *


# ── 6. Void invoice ─────────────────────────────────────────

POST {{api}}/billing/invoices/{{invoice_id}}/void
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *


# ── 7. Delete invoice ───────────────────────────────────────

DELETE {{api}}/billing/invoices/{{invoice_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP *


# ── 8. Merchant dashboard link ──────────────────────────────
# PREREQUISITE: Requires Stripe test keys and a merchant account
# Using a placeholder ID; real tests need a seeded merchant account.

POST {{api}}/billing/merchant-accounts/00000000-0000-0000-0000-000000000000/dashboard
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *


# ── 9. Stripe webhook ───────────────────────────────────────
# PREREQUISITE: Requires Stripe webhook secret

POST {{api}}/billing/webhooks/stripe
Content-Type: application/json
{
  "type": "invoice.paid",
  "data": { "object": {} }
}
HTTP *
