# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/credits — CPD config get + update (officer-scoped)
#
# Covers operationIds: getOrgCpdConfig, updateOrgCpdConfig
# (Wire names; both 1-line shims re-export getCpdConfig + updateCpdConfig
# real impls now at handlers/member/credits/ post-cutover.)
#
# Auth contract: getCpdConfig allows President | Secretary | Treasurer;
# updateCpdConfig restricts to President | Secretary. Seed officer
# test@memberry.ph = President so both allowed.
#
# Idempotency note: getCpdConfig auto-creates a default config (60/3/40/1)
# if none exists; updateCpdConfig PATCHes partial. Both safe to re-run.

# ── 0. Sign in as officer ──────────────────────────────────────────
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


# ── 1. getOrgCpdConfig → 200 or 201 (depending on prior state) ─────
# Probe-and-assert: accept either status; just confirm envelope shape +
# default values land. Re-runs see 200 every time after the first hit.
GET {{api}}/association/member/cpd-config/{{org_id}}
Cookie: better-auth.session_token={{officer_cookie}}
HTTP *
[Asserts]
status >= 200
status < 300
jsonpath "$.data.organizationId" == "{{org_id}}"
jsonpath "$.data.cycleLengthYears" exists


# ── 2. updateOrgCpdConfig → PATCH partial body, 200 ────────────────
PATCH {{api}}/association/member/cpd-config/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
Content-Type: application/json
{
  "requiredCredits": 90
}
HTTP 200
[Asserts]
jsonpath "$.data.organizationId" == "{{org_id}}"
jsonpath "$.data.requiredCredits" == 90


# ── 3. Restore to default so re-runs and other hurl files don't drift ──
PATCH {{api}}/association/member/cpd-config/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
Content-Type: application/json
{
  "requiredCredits": 60
}
HTTP 200
[Asserts]
jsonpath "$.data.requiredCredits" == 60


# ── 4. updateOrgCpdConfig rejects out-of-range cycleLengthYears → 400 ─
PATCH {{api}}/association/member/cpd-config/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
Content-Type: application/json
{
  "cycleLengthYears": 99
}
HTTP 400
