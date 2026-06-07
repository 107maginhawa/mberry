# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — application submit + approve flow
#
# Covers operationIds: createMembershipApplication, getMembershipApplication,
# approveMembershipApplication
# Real flow: applicant signs up, creates a membership application for the
# seeded org under a selected tier; officer signs in, fetches the
# application, approves it. Verifies the application → membership FK chain
# completes.
#
# Idempotency: fresh applicant signup per {{suffix}} satisfies any
# (organization_id, person_id) unique on applications.

# ── 0. Applicant signup ────────────────────────────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "applicant-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Applicant {{suffix}}"
}
HTTP 200
[Captures]
applicant_cookie: cookie "better-auth.session_token"
applicant_person_id: jsonpath "$.user.id"


# ── 1. Public tiers — get a tier the applicant can apply to ───────────
GET {{api}}/public/org/{{org_id}}/tiers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200
[Captures]
tier_id: jsonpath "$.data[0].id"


# ── 2. createMembershipApplication → 201 pending ─────────────────────
POST {{api}}/association/member/applications
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{applicant_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{applicant_person_id}}",
  "organizationId": "{{org_id}}",
  "tierId": "{{tier_id}}",
  "applicationDate": "2026-06-07"
}
HTTP 201
[Captures]
application_id: jsonpath "$.id"


# ── 3. Officer signs in ───────────────────────────────────────────────
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


# ── 4. getMembershipApplication → 200, sanity ─────────────────────────
GET {{api}}/association/member/applications/{{application_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{application_id}}"


# ── 5. approveMembershipApplication → 200 ─────────────────────────────
POST {{api}}/association/member/applications/{{application_id}}/approve
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{}
HTTP 200
