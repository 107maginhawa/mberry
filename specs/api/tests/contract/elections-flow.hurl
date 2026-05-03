# Business Rules: [BR-33]
# Elections module contract test: officer creates election,
# lists elections, gets details.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── Unauth → 401 ──────────────────────────────────────────

POST {{api}}/auth/sign-out
HTTP 200

GET {{api}}/elections/list/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── List elections ────────────────────────────────────────

GET {{api}}/elections/list/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── Create election ───────────────────────────────────────

POST {{api}}/elections/create/ed8e3a96-8126-4341-be42-e6eb7940c562
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

GET {{api}}/elections/detail/{{election_id}}
HTTP 200
