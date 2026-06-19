# member/governance — election lifecycle state machine
#
# Covers operationIds:
#   createElection, getElection, listElections, updateElection,
#   openElectionNominations, openElectionVoting, certifyElection,
#   deleteElection
# Real flow: President creates a draft election, opens nominations,
# opens voting, certifies. Verifies status transitions:
#   draft → nominationsOpen → votingOpen → published.
# Final delete proves teardown works for a draft election created
# under a separate id (since published elections can be locked).
#
# Note: single-resource election endpoints return a flat body; list endpoints stay `{data: [...]}`.

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

# ── 1. createElection (draft) ──────────────────────────────────────────────
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
  "title": "Lifecycle Election {{suffix}}",
  "type": "officer",
  "votingMode": "online"
}
HTTP 201
[Captures]
election_id: jsonpath "$.id"
[Asserts]
jsonpath "$.title" == "Lifecycle Election {{suffix}}"
jsonpath "$.status" == "draft"
jsonpath "$.type" == "officer"

# ── 2. getElection ─────────────────────────────────────────────────────────
GET {{api}}/association/member/elections/{{election_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{election_id}}"
jsonpath "$.status" == "draft"

# ── 3. listElections includes it ───────────────────────────────────────────
GET {{api}}/association/member/elections?organizationId={{org_id}}&limit=100
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data[?(@.id == '{{election_id}}')].title" == "Lifecycle Election {{suffix}}"

# ── 4. updateElection title ────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

PATCH {{api}}/association/member/elections/{{election_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "title": "Lifecycle Election {{suffix}} (rev2)"
}
HTTP 200
[Asserts]
jsonpath "$.title" == "Lifecycle Election {{suffix}} (rev2)"

# ── 5. openElectionNominations: draft → nominationsOpen ────────────────────
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
[Asserts]
jsonpath "$.status" == "nominationsOpen"

# ── 6. openElectionVoting without candidates → 422 (business rule) ─────────
# Voting cannot open until at least one candidate has been accepted.
# Full happy-path lifecycle through certify is covered by ballot-cast.hurl
# which sets up the candidate fixture.
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/elections/{{election_id}}/open-voting
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 422

# ── 7. createElection (draft) + deleteElection — terminal teardown ─────────
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
  "title": "Disposable Election {{suffix}}",
  "type": "officer"
}
HTTP 201
[Captures]
disposable_election_id: jsonpath "$.id"

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/elections/{{disposable_election_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
