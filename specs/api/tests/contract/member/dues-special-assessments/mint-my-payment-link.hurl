# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/dues-special-assessments — member self-serves a payment link for their own invoice
#
# Covers operationId: mintMyPaymentLink (association:member, POST /org/{organizationId}/payments/mint-mine)
#
# Real flow:
#   0. Sign in as seed officer (test@memberry.ph), who is simultaneously
#      President (association:admin) and a member (association:member) of the seed org.
#   1. Officer creates a dues invoice for themselves via createDuesInvoice.
#      membership_id is varchar(no FK) so any UUID is accepted.
#      personId omitted — handler defaults to session.user.id (= the caller).
#   2. Same session (already has association:member role) calls mint-mine → 201
#      with token + paymentUrl + expiresAt.
#
# Security / negative paths (IDOR 403, cross-org 403, paid 409, double-mint 409)
# are fully covered by mintMyPaymentLink.integration.test.ts (10-case real-PG suite).
# Contract layer: routing is registered + envelope shape is correct + 1h TTL fires.

# ── 0. Sign in as seed officer (also association:member of seed org) ──────────
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
member_cookie: cookie "better-auth.session_token"
officer_user_id: jsonpath "$.user.id"


# ── 1. Officer creates a dues invoice for themselves (personId = self) ────────
# CreateDuesInvoiceBody = DuesInvoiceSchema (full schema — auto-generated fields
# id/version/createdAt/updatedAt/invoiceNumber/generatedAt are validated but
# ignored by the handler, which overwrites them at the DB layer).
POST {{api}}/association/member/dues-invoices
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{member_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "id": "00000000-0000-4000-8000-0000000000cc",
  "version": 1,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "membershipId": "00000000-0000-4000-8000-000000000099",
  "personId": "{{officer_user_id}}",
  "organizationId": "{{org_id}}",
  "invoiceNumber": "INV-MINT-{{suffix}}",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-12-31",
  "totalAmount": 250000,
  "fundAllocations": [{ "fundName": "General", "amount": 250000, "percentage": 100, "isLast": true }],
  "status": "generated",
  "generatedAt": "2026-01-01T00:00:00.000Z"
}
HTTP 201
[Captures]
invoice_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "generated"


# ── 2. Member mints a one-tap payment link for their own invoice → 201 ────────
POST {{api}}/org/{{org_id}}/payments/mint-mine
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{member_cookie}}
Content-Type: application/json
{
  "invoiceId": "{{invoice_id}}"
}
HTTP 201
[Asserts]
jsonpath "$.token" exists
jsonpath "$.paymentUrl" exists
jsonpath "$.expiresAt" exists
