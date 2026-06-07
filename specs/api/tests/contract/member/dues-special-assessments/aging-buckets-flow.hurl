# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/duesspecialassessments — aging bucket + recalculate
#
# Covers operationIds: getAgingBucket, recalculateAgingBucket
# Real flow: officer reads current aging bucket snapshot, triggers
# recalculation (refreshes the bucket aggregates from current invoice
# state), then re-reads to verify the recalc surface returns a
# non-error response.

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


# ── 1. getAgingBucket → 200 ───────────────────────────────────────────
GET {{api}}/association/member/aging-buckets/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 2. recalculateAgingBucket → 200 ──────────────────────────────────
POST {{api}}/association/member/aging-buckets/{{org_id}}/recalculate
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 3. getAgingBucket again → 200 (verify recalc settled) ────────────
GET {{api}}/association/member/aging-buckets/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300
