# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — roster CRUD + import flow
#
# Covers operationIds: addRosterMember, listRosterMembers, getRosterMember,
# updateRosterMember, importRosterMembers
# Real flow: officer signs in, adds a fresh roster member,
# lists + fetches the new member, updates their member number,
# then bulk-imports 1 more member via importRosterMembers.
#
# Idempotency: fresh applicant signup per {{suffix}} satisfies
# (organization_id, person_id) unique on memberships.

# ── 0. Fresh applicant signup (for add) ──────────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "roster-add-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Roster Add {{suffix}}"
}
HTTP 200
[Captures]
add_person_id: jsonpath "$.user.id"


# ── 1. Second fresh applicant (for import) ───────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "roster-import-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Roster Import {{suffix}}"
}
HTTP 200
[Captures]
import_person_id: jsonpath "$.user.id"


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


# ── 4. addRosterMember → 201 ─────────────────────────────────────────
POST {{api}}/association/member/roster
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{add_person_id}}",
  "tierId": "{{tier_id}}",
  "memberNumber": "HRL-{{suffix}}",
  "startDate": "2026-01-01",
  "duesExpiryDate": "2026-12-31"
}
HTTP 201
[Captures]
new_member_id: jsonpath "$.id"


# ── 5. listRosterMembers → 200 ────────────────────────────────────────
GET {{api}}/association/member/roster?organizationId={{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200


# ── 6. getRosterMember → 200 ─────────────────────────────────────────
GET {{api}}/association/member/roster/{{new_member_id}}?organizationId={{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{new_member_id}}"


# ── 7. updateRosterMember → 200 ───────────────────────────────────────
PUT {{api}}/association/member/roster/{{new_member_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "memberNumber": "HRL-{{suffix}}-UPD"
}
HTTP 200


# ── 8. importRosterMembers → 200 ──────────────────────────────────────
POST {{api}}/association/member/roster/import
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "organizationId": "{{org_id}}",
  "members": [
    {
      "personId": "{{import_person_id}}",
      "tierId": "{{tier_id}}",
      "memberNumber": "IMP-{{suffix}}",
      "startDate": "2026-01-01",
      "duesExpiryDate": "2026-12-31"
    }
  ]
}
HTTP 200
