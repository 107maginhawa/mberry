# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Billing surface that does not require live Stripe credentials:
# auth gates and an empty invoice listing. Full invoice/merchant flows
# require STRIPE_SECRET_KEY and a Stripe (or stripe-mock) backend, which
# is intentionally out of scope for the contract suite.

GET {{api}}/billing/invoices
HTTP 401


POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "billing-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Billing Tester"
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
  "firstName": "Billing",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. List invoices - empty paginated envelope.
GET {{api}}/billing/invoices
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" exists
