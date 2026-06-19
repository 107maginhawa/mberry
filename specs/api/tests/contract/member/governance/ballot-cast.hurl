# member/governance — ballot cast + list
#
# Covers operationIds: castBallot, listBallots
# Preconditions: createPosition, createElection, openElectionNominations,
# createCandidate, updateCandidateStatus → accepted, openElectionVoting.
# Real flow: President sets up an election in votingOpen with one accepted
# candidate (seed member01), then casts a ballot in their own name (also
# a member) for that candidate, lists ballots to verify the row is present.
#
# Election and candidate endpoints wrap responses in `{data: ...}` envelope.

# ── 0. Resolve seed nominee personId (member01) ────────────────────────────
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

# ── 1. Sign in as President (also a member of the org → can vote) ──────────
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

# ── 2. Position ────────────────────────────────────────────────────────────
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
  "title": "Ballot Position {{suffix}}",
  "organizationId": "{{org_id}}",
  "level": "chapter",
  "termLengthMonths": 12,
  "status": "active"
}
HTTP 201
[Captures]
position_id: jsonpath "$.id"

# ── 3. Election ────────────────────────────────────────────────────────────
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
  "title": "Ballot Election {{suffix}}",
  "type": "officer"
}
HTTP 201
[Captures]
election_id: jsonpath "$.id"

# ── 4. Transition draft → nominationsOpen ──────────────────────────────────
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

# ── 5. Candidate ───────────────────────────────────────────────────────────
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
  "nominatedBy": "{{officer_user_id}}"
}
HTTP 201
[Captures]
candidate_id: jsonpath "$.id"

# ── 6. Nominee accepts ─────────────────────────────────────────────────────
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

# ── 7. Open voting ─────────────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/elections/{{election_id}}/open-voting
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data.status" == "votingOpen"

# ── 8. castBallot ──────────────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/ballots
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "electionId": "{{election_id}}",
  "positionId": "{{position_id}}",
  "candidateId": "{{candidate_id}}",
  "isProxy": false
}
HTTP 201

# ── 9. listBallots ─────────────────────────────────────────────────────────
GET {{api}}/association/member/ballots?electionId={{election_id}}&limit=50
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
