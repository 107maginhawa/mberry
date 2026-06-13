# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — terminal-state transitions
#
# Covers operationIds: terminateMembership, deceaseMembership,
# updateMembership, deleteMembership
# Real flow: 2 fresh applicants get memberships. Officer terminates one
# with reason (BR: terminal state, no reinstate). Officer marks the other
# deceased with date of death. Then verifies update + delete still work
# on a third path (PATCH metadata, then DELETE).
#
# Idempotency: fresh applicants per {{suffix}} satisfy (org, person) unique.

# ── 0. Applicant A signup (terminate target) ─────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "term-a-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Term A {{suffix}}"
}
HTTP 200
[Captures]
person_a_id: jsonpath "$.user.id"


# ── 1. Applicant B signup (decease target) ───────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "term-b-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Term B {{suffix}}"
}
HTTP 200
[Captures]
person_b_id: jsonpath "$.user.id"


# ── 2. Officer signs in ───────────────────────────────────────────────
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


# ── 3. List tiers (need tier_id) ──────────────────────────────────────
GET {{api}}/association/member/tiers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Captures]
tier_id: jsonpath "$.data[0].id"


# ── 4. createMembership A → 201 ───────────────────────────────────────
POST {{api}}/association/member/memberships
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{person_a_id}}",
  "organizationId": "{{org_id}}",
  "tierId": "{{tier_id}}",
  "startDate": "2026-01-01",
  "duesExpiryDate": "2026-12-31"
}
HTTP 201
[Captures]
membership_a_id: jsonpath "$.id"


# ── 5. createMembership B → 201 ───────────────────────────────────────
POST {{api}}/association/member/memberships
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{person_b_id}}",
  "organizationId": "{{org_id}}",
  "tierId": "{{tier_id}}",
  "startDate": "2026-01-01",
  "duesExpiryDate": "2026-12-31"
}
HTTP 201
[Captures]
membership_b_id: jsonpath "$.id"


# ── 6. terminateMembership (A) → 200 ──────────────────────────────────
POST {{api}}/association/member/memberships/{{membership_a_id}}/terminate
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "terminationReason": "Hurl terminate test — bylaw violation"
}
HTTP 200


# ── 7. deceaseMembership (B) → 200 ────────────────────────────────────
POST {{api}}/association/member/memberships/{{membership_b_id}}/deceased
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "dateOfDeath": "2026-05-15",
  "terminationReason": "Hurl decease test"
}
HTTP 200


# ── 8. updateMembership (A — post-terminal metadata edit) ────────────
PATCH {{api}}/association/member/memberships/{{membership_a_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "memberNumber": "TERM-{{suffix}}"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 9. deleteMembership removed (FIX-011 / decision #6) ───────────────
# Officers use terminal states (terminate/resign/decease) which preserve
# history; the officer-facing hard-delete op no longer exists, so the route
# must NOT perform a delete.
DELETE {{api}}/association/member/memberships/{{membership_a_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 400
