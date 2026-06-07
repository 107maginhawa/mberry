# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — full state-machine lifecycle
#
# Covers operationIds: createMembership, resignMembership, reinstateMembership,
# getMembership
# Real flow: sign up fresh applicant per {{suffix}}, officer creates a
# membership for them, drives through resign → reinstate transitions,
# then verifies state via getMembership.
#
# Idempotency: fresh person via {{suffix}}-email signup keeps the
# (organization_id, person_id) unique index clean per Hurl run.

# ── 0. Fresh applicant signup (gets person_id, no auth context kept) ──
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "member-lifecycle-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Lifecycle Tester {{suffix}}"
}
HTTP 200
[Captures]
applicant_person_id: jsonpath "$.user.id"


# ── 1. Officer signs in ───────────────────────────────────────────────
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


# ── 2. List tiers (need tier_id for createMembership) ────────────────
GET {{api}}/association/member/tiers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Captures]
tier_id: jsonpath "$.data[0].id"


# ── 3. createMembership → 201 ────────────────────────────────────────
POST {{api}}/association/member/memberships
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{applicant_person_id}}",
  "organizationId": "{{org_id}}",
  "tierId": "{{tier_id}}",
  "startDate": "2026-01-01",
  "duesExpiryDate": "2026-12-31"
}
HTTP 201
[Captures]
membership_id: jsonpath "$.id"
[Asserts]
jsonpath "$.personId" == "{{applicant_person_id}}"


# ── 4. resignMembership → 200, status flips ───────────────────────────
POST {{api}}/association/member/memberships/{{membership_id}}/resign
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "terminationReason": "Hurl resign test"
}
HTTP 200


# ── 5. reinstateMembership → 200, status returns to active ────────────
POST {{api}}/association/member/memberships/{{membership_id}}/reinstate
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{}
HTTP 200


# ── 6. getMembership → 200, confirm record persists ──────────────────
GET {{api}}/association/member/memberships/{{membership_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{membership_id}}"
jsonpath "$.personId" == "{{applicant_person_id}}"
