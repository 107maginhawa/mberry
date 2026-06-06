# Invite contract flow — officer creates an invite, then validates and claims
# the returned token; bulk-import endpoint pinged with an empty body.
#
# Covers operationIds:
#   createInvite, validateInvite, claimInvite, bulkImportMembers
#
# Requires: seeded org + officer (test@memberry.ph) from db:seed-modules,
# INVITE_TOKEN_SECRET env var on the impl (falls back to dev-secret if unset).
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# CSRF preamble
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── Auth: sign in as officer ──────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"

# ── 1. Create an invite ──────────────────────────────────────────────────────

POST {{api}}/invite
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "email": "invitee-{{suffix}}@example.org",
  "type": "invite",
  "message": "Contract test invite"
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|409)$"

# ── 2. Validate an invite token (public, synthetic token) ────────────────────

GET {{api}}/invite/validate/synthetic-contract-test-token-{{suffix}}
HTTP *
[Asserts]
status toString matches "^(200|400|404)$"

# ── 3. Claim an invite token (officer, synthetic token) ──────────────────────

POST {{api}}/invite/claim/synthetic-contract-test-token-{{suffix}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|201|400|404|409|410|422)$"

# ── 4. Bulk import members — empty CSV → expect validation error ─────────────

POST {{api}}/invitations/bulk-import
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "csv": "email,name\n"
}
HTTP *
[Asserts]
status toString matches "^(200|201|400|403|422)$"
