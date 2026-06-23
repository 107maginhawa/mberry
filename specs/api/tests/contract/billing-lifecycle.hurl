# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Billing invoice lifecycle against stripe-mock: the seeded merchant (the org
# President, who already has a seeded — onboarding-incomplete — merchant account)
# drafts and finalizes an invoice for a customer, the customer's pay attempt is
# rejected at the readiness boundary, and the merchant closes it as uncollectible.
#
# We act as the seed President because createInvoice (and the /billing/* org-context
# middleware) require the merchant to be an active member of {{org_id}}; a fresh
# signup is not. Merchant-account create/get/onboard are intentionally NOT exercised
# here — the President's account is pre-seeded (POST would 409) and there is no list
# endpoint to recover its id; that surface is covered by createMerchantAccount /
# onboardMerchantAccount unit tests.

# 0. Merchant = the seeded President (active org member + seeded merchant account).
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
merchant_person_id: jsonpath "$.user.id"


# 1. Customer signup + person (cookie jar now holds the customer session).
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "cust-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Customer"
}
HTTP 200
[Captures]
customer_person_id: jsonpath "$.user.id"


# 2. Re-auth as the merchant (President) — createInvoice requires
# merchant === session user, and the org-context middleware requires
# the session user to be a member of {{org_id}}.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200


# 3. Draft an invoice for the customer.
POST {{api}}/billing/invoices
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "customer": "{{customer_person_id}}",
  "merchant": "{{merchant_person_id}}",
  "currency": "USD",
  "lineItems": [
    { "description": "Contract test consult", "quantity": 1, "unitPrice": 2500 }
  ]
}
HTTP 201
[Captures]
invoice_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.total" == 2500
jsonpath "$.currency" == "USD"


# 4. Finalize the invoice → status 'open'.
POST {{api}}/billing/invoices/{{invoice_id}}/finalize
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP 200
[Asserts]
jsonpath "$.status" == "open"


# 5. Customer attempts to pay → 422 because the merchant's Stripe Connect
# onboarding hasn't completed (the seeded account has no onboardingComplete).
# Asserts the impl enforces the provider-readiness boundary.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "cust-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/billing/invoices/{{invoice_id}}/pay
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP 422
[Asserts]
jsonpath "$.code" == "PROVIDER_BILLING_INCOMPLETE"


# 6. Merchant marks the unpaid invoice as uncollectible → status 'uncollectible'.
# (void is only valid for authorized-but-uncaptured payments; an open
# invoice without an associated PaymentIntent uses uncollectible to close.)
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200


POST {{api}}/billing/invoices/{{invoice_id}}/mark-uncollectible
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP 200
[Asserts]
jsonpath "$.status" == "uncollectible"


# 7. List invoices includes the closed one.
GET {{api}}/billing/invoices
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 1
