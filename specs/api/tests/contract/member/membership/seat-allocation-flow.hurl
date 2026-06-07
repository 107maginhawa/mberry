# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — institutional-membership + seat allocation flow
#
# Covers operationIds: createInstitutionalMembership, allocateSeat,
# listSeatAllocations, revokeSeat
# Real flow: officer signs in, creates an institutional membership (uses
# the seeded org as both child and parent), allocates a seat to a fresh
# person, lists allocations, then revokes the seat. Verifies
# uq(institutional_membership_id, person_id) prevents double-allocation.
#
# Idempotency: fresh applicant signup per {{suffix}} satisfies the unique
# seat constraint; fresh institutional membership per run.

# ── 0. Fresh seat-holder signup ───────────────────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "seat-holder-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Seat Holder {{suffix}}"
}
HTTP 200
[Captures]
seat_person_id: jsonpath "$.user.id"


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
officer_person_id: jsonpath "$.user.id"


# ── 2. List tiers ──────────────────────────────────────────────────────
GET {{api}}/association/member/tiers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Captures]
tier_id: jsonpath "$.data[0].id"


# ── 3. createInstitutionalMembership → 201 ───────────────────────────
POST {{api}}/association/member/institutional-memberships
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "organizationId": "{{org_id}}",
  "parentOrganizationId": "{{org_id}}",
  "tierId": "{{tier_id}}",
  "totalSeats": 5,
  "primaryContactId": "{{officer_person_id}}",
  "startDate": "2026-01-01",
  "duesExpiryDate": "2026-12-31"
}
HTTP *
[Asserts]
status >= 200
status < 300
[Captures]
inst_membership_id: jsonpath "$.id"


# ── 4. allocateSeat → 200/201 ────────────────────────────────────────
POST {{api}}/association/member/institutional-memberships/{{inst_membership_id}}/seats
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{seat_person_id}}"
}
HTTP *
[Asserts]
status >= 200
status < 300
[Captures]
seat_allocation_id: jsonpath "$.id"


# ── 5. listSeatAllocations → 200 ──────────────────────────────────────
GET {{api}}/association/member/institutional-memberships/{{inst_membership_id}}/seats
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200


# ── 6. revokeSeat → 200 ────────────────────────────────────────────────
POST {{api}}/association/member/institutional-memberships/{{inst_membership_id}}/seats/{{seat_allocation_id}}/revoke
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{}
HTTP 200
