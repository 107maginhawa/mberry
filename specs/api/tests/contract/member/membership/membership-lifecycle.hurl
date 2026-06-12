# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — terminal-state lifecycle (resign is irreversible)
#
# Covers operationIds: createMembership, resignMembership, reinstateMembership,
# getMembership
# Real flow: sign up fresh applicant per {{suffix}}, officer creates a
# membership for them, resigns it, then asserts the decided state-machine
# semantics — resign is terminal, and reinstate (lapsed-only, decision #1)
# rejects a resigned member. getMembership confirms the resignation persists.
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


# ── 5. reinstateMembership of a RESIGNED member → 422 (terminal) ─────
# FIX-007/008 / decision #1: removed/resigned/deceased/expelled are terminal +
# irreversible. Reinstate is LAPSED-ONLY, so reinstating a resigned member is
# rejected — re-entry would go through re-application, not reinstate.
POST {{api}}/association/member/memberships/{{membership_id}}/reinstate
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{}
HTTP 422


# ── 6. getMembership → 200, the resignation persists as 'resigned' ───
# FIX-007: a resignation stamps resigned_at, so the status survives as
# 'resigned' (it does NOT decay to 'removed').
GET {{api}}/association/member/memberships/{{membership_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{membership_id}}"
jsonpath "$.personId" == "{{applicant_person_id}}"
jsonpath "$.status" == "resigned"
