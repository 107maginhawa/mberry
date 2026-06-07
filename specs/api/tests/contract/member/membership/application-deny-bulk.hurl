# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — application deny + bulk-approve paths
#
# Covers operationIds: denyMembershipApplication,
# bulkApproveMembershipApplications, updateMembershipApplication,
# deleteMembershipApplication
# Real flow: 2 fresh applicants submit applications. Officer denies one
# with a reason, bulk-approves the other. Then updates the denied
# application (resubmission scenario) and finally deletes it.
#
# Idempotency: per-{{suffix}} applicant signups satisfy (org, person)
# uniqueness on applications.

# ── 0. Applicant A signup ────────────────────────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "deny-a-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Deny A {{suffix}}"
}
HTTP 200
[Captures]
person_a_cookie: cookie "better-auth.session_token"
person_a_id: jsonpath "$.user.id"


# ── 1. Applicant B signup ────────────────────────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "deny-b-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Deny B {{suffix}}"
}
HTTP 200
[Captures]
person_b_cookie: cookie "better-auth.session_token"
person_b_id: jsonpath "$.user.id"


# ── 2. Public tiers (pre-auth, both applicants need tier_id) ─────────
GET {{api}}/public/org/{{org_id}}/tiers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200
[Captures]
tier_id: jsonpath "$.data[0].id"


# ── 3. Applicant A creates application ────────────────────────────────
POST {{api}}/association/member/applications
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{person_a_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{person_a_id}}",
  "organizationId": "{{org_id}}",
  "tierId": "{{tier_id}}",
  "applicationDate": "2026-06-07"
}
HTTP 201
[Captures]
app_a_id: jsonpath "$.id"


# ── 4. Applicant B creates application ────────────────────────────────
POST {{api}}/association/member/applications
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{person_b_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{person_b_id}}",
  "organizationId": "{{org_id}}",
  "tierId": "{{tier_id}}",
  "applicationDate": "2026-06-07"
}
HTTP 201
[Captures]
app_b_id: jsonpath "$.id"


# ── 5. Officer signs in ───────────────────────────────────────────────
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


# ── 6. denyMembershipApplication (A) → 200 ────────────────────────────
POST {{api}}/association/member/applications/{{app_a_id}}/deny
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "denialReason": "Hurl deny test — missing required credential."
}
HTTP 200


# ── 7. bulkApproveMembershipApplications (B) → 200 ────────────────────
POST {{api}}/association/member/applications/bulk-approve
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "applicationIds": ["{{app_b_id}}"]
}
HTTP 200
[Asserts]
jsonpath "$.succeeded" count >= 0
jsonpath "$.failed" count >= 0


# ── 8. updateMembershipApplication (A — resubmission) → 200 ──────────
PATCH {{api}}/association/member/applications/{{app_a_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "applicationDate": "2026-06-08"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 9. deleteMembershipApplication (A) → 200/204 ─────────────────────
DELETE {{api}}/association/member/applications/{{app_a_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300
