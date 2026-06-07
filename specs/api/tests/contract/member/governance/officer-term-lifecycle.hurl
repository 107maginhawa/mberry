# member/governance — officer-term CRUD lifecycle
#
# Covers operationIds:
#   createOfficerTerm, getOfficerTerm, listOfficerTerms,
#   updateOfficerTerm, deleteOfficerTerm
#   (plus createPosition as a precondition for the term's positionId)
# Real flow: President creates a position, signs up a new person, assigns
# them an officer term, reads the term, lists, updates status to active,
# deletes the term. Verifies DB roundtrip on every step.

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

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

# ── 1. Sign up a fresh person to assign to the term ────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "officer-term-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Officer Term Target {{suffix}}"
}
HTTP 200
[Captures]
target_person_id: jsonpath "$.user.id"

# Re-establish officer session.
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

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

# ── 2. createPosition precondition ─────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/positions
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "title": "OT Position {{suffix}}",
  "organizationId": "{{org_id}}",
  "level": "chapter",
  "termLengthMonths": 12,
  "status": "active"
}
HTTP 201
[Captures]
position_id: jsonpath "$.id"

# ── 3. createOfficerTerm ───────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/officer-terms
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "positionId": "{{position_id}}",
  "personId": "{{target_person_id}}",
  "organizationId": "{{org_id}}",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "status": "upcoming"
}
HTTP 201
[Captures]
term_id: jsonpath "$.id"
[Asserts]
jsonpath "$.positionId" == "{{position_id}}"
jsonpath "$.personId" == "{{target_person_id}}"
jsonpath "$.status" == "upcoming"

# ── 4. getOfficerTerm ──────────────────────────────────────────────────────
GET {{api}}/association/member/officer-terms/{{term_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{term_id}}"

# ── 5. listOfficerTerms filtered by person ─────────────────────────────────
GET {{api}}/association/member/officer-terms?personId={{target_person_id}}&limit=50
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.items[?(@.id == '{{term_id}}')].positionId" == "{{position_id}}"

# ── 6. updateOfficerTerm → status=active ───────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

PATCH {{api}}/association/member/officer-terms/{{term_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"

# ── 7. deleteOfficerTerm ───────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/officer-terms/{{term_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200

# ── 8. Cleanup — delete position ───────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/positions/{{position_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
