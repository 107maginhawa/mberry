# member/governance — RBAC contracts (401 + 403)
#
# Locks the authorization edges of the governance surface:
#   - Unauthenticated callers get 401 on mutating endpoints.
#   - A signed-in non-officer user gets 403 on createPosition,
#     createElection, createOfficerTerm (all require President position).

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Unauthenticated createPosition → 401 ────────────────────────────────
POST {{api}}/association/member/positions
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "title": "RBAC Probe {{suffix}}",
  "organizationId": "{{org_id}}",
  "level": "chapter",
  "termLengthMonths": 12,
  "status": "active"
}
HTTP 401

# ── 1. Unauthenticated createElection → 401 ────────────────────────────────
POST {{api}}/association/member/elections
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "organizationId": "{{org_id}}",
  "title": "RBAC Probe {{suffix}}",
  "type": "officer"
}
HTTP 401

# ── 2. Unauthenticated castBallot → 401 ────────────────────────────────────
POST {{api}}/association/member/ballots
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "electionId": "00000000-0000-0000-0000-000000000000",
  "positionId": "00000000-0000-0000-0000-000000000000",
  "candidateId": "00000000-0000-0000-0000-000000000000",
  "isProxy": false
}
HTTP 401

# ── 3. Sign up a fresh user with no officer position ───────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "rbac-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "RBAC Probe {{suffix}}"
}
HTTP 200
[Captures]
plain_user_cookie: cookie "better-auth.session_token"

# ── 4. Non-officer createPosition → 403 ────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/positions
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{plain_user_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "title": "Plain User Position {{suffix}}",
  "organizationId": "{{org_id}}",
  "level": "chapter",
  "termLengthMonths": 12,
  "status": "active"
}
HTTP 403

# ── 5. Non-officer createElection → 403 ────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/elections
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{plain_user_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "organizationId": "{{org_id}}",
  "title": "Plain User Election {{suffix}}",
  "type": "officer"
}
HTTP 403

# ── 6. Non-officer createOfficerTerm → 403 ─────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/officer-terms
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{plain_user_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "positionId": "00000000-0000-0000-0000-000000000000",
  "personId": "00000000-0000-0000-0000-000000000000",
  "organizationId": "{{org_id}}",
  "startDate": "2026-01-01"
}
HTTP 403
