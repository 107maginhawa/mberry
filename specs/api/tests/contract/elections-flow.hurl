# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-33]
# Elections module contract test: officer creates election,
# lists elections, gets details.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── Unauth → 401 ──────────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/member/elections
HTTP 401

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── List elections ────────────────────────────────────────

GET {{api}}/association/member/elections
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── Create election ───────────────────────────────────────

POST {{api}}/association/member/elections
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Contract Test Election {{suffix}}",
  "description": "Board election",
  "nominationStart": "2026-11-01T00:00:00Z",
  "nominationEnd": "2026-11-15T00:00:00Z",
  "votingStart": "2026-11-16T00:00:00Z",
  "votingEnd": "2026-11-30T00:00:00Z",
  "positions": 3
}
HTTP 201
[Captures]
election_id: jsonpath "$.data.id"


# ── Get election ──────────────────────────────────────────

GET {{api}}/association/member/elections/{{election_id}}
HTTP 200
