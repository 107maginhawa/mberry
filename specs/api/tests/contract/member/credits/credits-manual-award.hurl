# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/credits — officer awards a manual credit (sync path)
#
# Covers operationId: awardManualCredit
# Real flow: officer (President = seed test@memberry.ph) signs in and
# awards a manual credit to themselves (officer_person_id) — officer
# is a seeded member so person_id FK is satisfied. idempotencyKey
# uses Hurl's built-in {{newUuid}} — required because the underlying
# credit_entry.source_id column is a uuid type (handler writes
# body.idempotencyKey directly into source_id), so the key MUST parse
# as a valid UUID. Random-per-run keeps the suite idempotent against
# uq_credit_source_person across re-runs without DB resets.

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
officer_person_id: jsonpath "$.user.id"


# ── 1. awardManualCredit → 201, direct {data: <entry>} envelope ────
POST {{api}}/association/member/credits/manual
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{officer_person_id}}",
  "activityName": "Hurl Manual Credit Test {{suffix}}",
  "activityDate": "2026-01-15T00:00:00Z",
  "creditAmount": 5,
  "idempotencyKey": "{{newUuid}}",
  "category": "General"
}
HTTP 201
[Asserts]
jsonpath "$.data.personId" == "{{officer_person_id}}"
jsonpath "$.data.creditAmount" == 5
jsonpath "$.data.activityName" == "Hurl Manual Credit Test {{suffix}}"
jsonpath "$.data.status" == "active"
jsonpath "$.data.sourceType" == "manual_award"
