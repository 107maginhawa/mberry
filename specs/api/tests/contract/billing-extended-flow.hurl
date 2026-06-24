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

# Act as the seed officer: createInvoice requires merchant === session user AND
# the /billing/* org-context middleware requires that user to be a member of
# {{org_id}}. A fresh signup is neither, so it cannot create an org-scoped invoice.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

POST {{api}}/billing/invoices
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "customer": "{{person_id}}",
  "merchant": "{{person_id}}",
  "currency": "USD",
  "lineItems": [
    { "description": "Contract test invoice {{suffix}}", "quantity": 1, "unitPrice": 5000 }
  ]
}
HTTP *
[Captures]
invoice_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300


# ── 2. Get single invoice ───────────────────────────────────

GET {{api}}/billing/invoices/{{invoice_id}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 3. Update invoice ───────────────────────────────────────

PATCH {{api}}/billing/invoices/{{invoice_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
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
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP *


# ── 5. Refund invoice ───────────────────────────────────────
# PREREQUISITE: Requires Stripe test keys and captured payment

POST {{api}}/billing/invoices/{{invoice_id}}/refund
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP *


# ── 6. Void invoice ─────────────────────────────────────────

POST {{api}}/billing/invoices/{{invoice_id}}/void
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP *


# ── 7. Delete invoice ───────────────────────────────────────

DELETE {{api}}/billing/invoices/{{invoice_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
HTTP *


# ── 8. Merchant dashboard link ──────────────────────────────
# PREREQUISITE: Requires Stripe test keys and a merchant account
# Using a placeholder ID; real tests need a seeded merchant account.

POST {{api}}/billing/merchant-accounts/00000000-0000-0000-0000-000000000000/dashboard
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *


# ── 9. Stripe webhook ───────────────────────────────────────
# PREREQUISITE: Requires Stripe webhook secret

POST {{api}}/billing/webhooks/stripe
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "type": "invoice.paid",
  "data": { "object": {} }
}
HTTP *
