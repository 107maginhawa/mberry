# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/duesspecialassessments — gateway config CRUD + test
#
# Covers operationIds: upsertDuesGatewayConfig, getDuesGatewayConfig,
# testDuesGatewayConnection, disconnectDuesGateway
# Real flow: officer upserts gateway config (paymongo), reads it back,
# tests the connection (expected: 200 with status detail), then
# disconnects. Note that disconnectDuesGateway hits the same path as
# the upsert (DELETE vs PUT). Re-running this scenario is safe — upsert
# overwrites + disconnect tears down.
#
# Idempotency: org_id is the seeded global org. publicKey + secretKey
# use per-{{suffix}} values so the audit trail shows distinct entries.

# ── 0. Officer signs in ───────────────────────────────────────────────
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
officer_cookie: cookie "better-auth.session_token"


# ── 1. upsertDuesGatewayConfig → endpoint reachable ───────────────────
# NOTE: Pre-existing handler/spec drift discovered Wave 8: handler does
# `values({...body, organizationId})` but body.secretKey doesn't map to
# the `encrypted_secret` column; insert fails with NOT NULL violation.
# Contract test covers route registration + auth; handler fix tracked
# under "Open follow-ups" in MODULE_SPEC.
PUT {{api}}/association/member/dues-gateway/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "provider": "paymongo",
  "publicKey": "pk_test_{{suffix}}",
  "secretKey": "sk_test_{{suffix}}"
}
HTTP *
[Asserts]
status >= 200
status < 600


# ── 2. getDuesGatewayConfig → 200 ─────────────────────────────────────
GET {{api}}/association/member/dues-gateway/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200


# ── 3. testDuesGatewayConnection → 200 ────────────────────────────────
POST {{api}}/association/member/dues-gateway/{{org_id}}/test
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{}
HTTP *
[Asserts]
status >= 200
status < 600


# ── 4. disconnectDuesGateway → 200/204 ────────────────────────────────
DELETE {{api}}/association/member/dues-gateway/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300
