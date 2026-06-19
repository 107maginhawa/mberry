# member/governance — candidate CRUD + acceptance status
#
# Covers operationIds:
#   createCandidate, getCandidate, listCandidates, updateCandidate,
#   updateCandidateStatus, deleteCandidate
# Real flow: President creates a position, picks an existing seed member
# (member01@memberry.ph — Isabella Dela Cruz, already an org member),
# creates an election in nominationsOpen state, creates a candidate
# slot for that member, updates the bio, nominee-accepts the
# nomination, deletes the candidate.
#
# Uses seed member to satisfy the org-membership check in createCandidate.
# Single-resource endpoints return a flat body (no `{data: ...}` envelope); lists stay enveloped.

# ── 0. Resolve member01 personId ───────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "member01@memberry.ph",
  "password": "{{seed_officer_password}}"
}
HTTP 200
[Captures]
nominee_person_id: jsonpath "$.user.id"

# ── 1. Sign in as President ────────────────────────────────────────────────
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
officer_user_id: jsonpath "$.user.id"

# ── 2. Precondition: position ──────────────────────────────────────────────
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
  "title": "Cand Position {{suffix}}",
  "organizationId": "{{org_id}}",
  "level": "chapter",
  "termLengthMonths": 12,
  "status": "active"
}
HTTP 201
[Captures]
position_id: jsonpath "$.id"

# ── 3. Precondition: election in nominationsOpen ───────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/elections
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "organizationId": "{{org_id}}",
  "title": "Candidate Election {{suffix}}",
  "type": "officer"
}
HTTP 201
[Captures]
election_id: jsonpath "$.id"

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/elections/{{election_id}}/open-nominations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200

# ── 4. createCandidate ─────────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/candidates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "electionId": "{{election_id}}",
  "positionId": "{{position_id}}",
  "personId": "{{nominee_person_id}}",
  "nominatedBy": "{{officer_user_id}}",
  "bio": "First bio",
  "platform": "Test platform"
}
HTTP 201
[Captures]
candidate_id: jsonpath "$.id"

# ── 5. getCandidate ────────────────────────────────────────────────────────
GET {{api}}/association/member/candidates/{{candidate_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{candidate_id}}"

# ── 6. listCandidates filtered by election ─────────────────────────────────
GET {{api}}/association/member/candidates?electionId={{election_id}}&limit=50
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200

# ── 7. updateCandidate bio ─────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

PATCH {{api}}/association/member/candidates/{{candidate_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "bio": "Updated bio"
}
HTTP 200

# ── 8. updateCandidateStatus → accepted ────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/candidates/{{candidate_id}}/status
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "status": "accepted"
}
HTTP 200

# ── 9. deleteCandidate ─────────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/candidates/{{candidate_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
