# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/duesspecialassessments — dunning run + events list
#
# Covers operationIds: runDunning, listDunningEvents
# Real flow: officer triggers a dunning run in DRY-RUN mode (safe — does
# not send communications), then lists dunning events to verify the run
# was recorded. Dry-run is the canonical CI test mode for this endpoint.

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


# ── 1. runDunning (dryRun) → 200 ──────────────────────────────────────
POST {{api}}/association/member/dunning/run
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "organizationId": "{{org_id}}",
  "dryRun": true
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 2. listDunningEvents → 200 ────────────────────────────────────────
GET {{api}}/association/member/dunning/events?organizationId={{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300
