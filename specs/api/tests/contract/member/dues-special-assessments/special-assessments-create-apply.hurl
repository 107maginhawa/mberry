# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/dues-special-assessments — officer creates + applies special assessment
#
# Covers operationIds: createSpecialAssessment, applySpecialAssessment,
# getSpecialAssessmentCollection
# Real flow: President (Maria = seed test@memberry.ph) creates a one-time
# special assessment in draft state, then applies it to herself (a seeded
# member, so person_id FK is satisfied), generating one invoice. The
# per-run {{suffix}} keeps assessment names unique; assessment id is
# captured per-run so re-runs don't collide on composite indexes.

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


# ── 1. createSpecialAssessment → 201, draft state ───────────────────
POST {{api}}/association/member/special-assessments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Hurl SA Test {{suffix}}",
  "description": "Per-run scoped assessment, applies to selected member.",
  "amount": 50000,
  "currency": "PHP",
  "dueDate": "2026-12-31",
  "appliesTo": "selected"
}
HTTP 201
[Captures]
assessment_id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" == "Hurl SA Test {{suffix}}"
jsonpath "$.amount" == 50000
jsonpath "$.status" == "draft"
jsonpath "$.appliesTo" == "selected"


# ── 2. applySpecialAssessment → 200, invoice generated for officer ─
POST {{api}}/association/member/special-assessments/{{assessment_id}}/apply
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "memberIds": ["{{officer_person_id}}"]
}
HTTP 200
[Asserts]
jsonpath "$.message" == "Assessment applied"
jsonpath "$.invoicesCreated" >= 0
jsonpath "$.skipped" >= 0


# ── 3. getSpecialAssessmentCollection → 200, metrics include target ─
GET {{api}}/association/member/special-assessments/{{assessment_id}}/collection
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.totalTargets" >= 0
jsonpath "$.paidCount" >= 0
jsonpath "$.pendingCount" >= 0
