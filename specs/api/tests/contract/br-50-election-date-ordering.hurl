# Business Rules: [BR-50]
# Election Date Ordering DB Constraints
#
# Source: services/api-ts/src/handlers/elections/repos/elections.schema.ts:29-31
#   check('election_nominations_date_order', nominationsCloseAt > nominationsOpenAt)
#   check('election_voting_date_order',      votingCloseAt      > votingOpenAt)
#   check('election_nominations_before_voting', votingOpenAt   >= nominationsCloseAt)
#
# Contract: PATCH /association/member/elections/{id} with date fields that
# violate ordering must be rejected with HTTP 400 (constraint violation).
# The DB CHECK constraints are the canonical enforcement; this contract test
# verifies the wire-level rejection surfaces correctly through the handler.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562.

# 0. Auth setup.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "br50-dates-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "BR-50 Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "BR50",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "Asia/Manila"
}
HTTP 201


# 1. Create an election (draft).
POST {{api}}/association/member/elections
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "BR-50 Date Order Election {{suffix}}",
  "description": "Date ordering test",
  "type": "officer",
  "votingMode": "online"
}
HTTP 201
[Captures]
election_id: jsonpath "$.id"


# 2. [BR-50] Attempt to set nominations_close BEFORE nominations_open.
#    DB CHECK 'election_nominations_date_order' must reject.
PATCH {{api}}/association/member/elections/{{election_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "nominationsOpenAt":  "2026-11-30T00:00:00Z",
  "nominationsCloseAt": "2026-11-01T00:00:00Z"
}
HTTP 400


# 3. [BR-50] Attempt to set voting_close BEFORE voting_open.
#    DB CHECK 'election_voting_date_order' must reject.
PATCH {{api}}/association/member/elections/{{election_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "votingOpenAt":  "2026-12-30T00:00:00Z",
  "votingCloseAt": "2026-12-01T00:00:00Z"
}
HTTP 400


# 4. [BR-50] Attempt to set voting_open BEFORE nominations_close.
#    DB CHECK 'election_nominations_before_voting' must reject.
PATCH {{api}}/association/member/elections/{{election_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "nominationsOpenAt":  "2026-11-01T00:00:00Z",
  "nominationsCloseAt": "2026-11-30T00:00:00Z",
  "votingOpenAt":       "2026-11-15T00:00:00Z",
  "votingCloseAt":      "2026-12-30T00:00:00Z"
}
HTTP 400


# 5. Positive control: a well-ordered date set succeeds.
PATCH {{api}}/association/member/elections/{{election_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "nominationsOpenAt":  "2026-11-01T00:00:00Z",
  "nominationsCloseAt": "2026-11-30T00:00:00Z",
  "votingOpenAt":       "2026-12-01T00:00:00Z",
  "votingCloseAt":      "2026-12-30T00:00:00Z"
}
HTTP 200


# 6. Cleanup.
DELETE {{api}}/association/member/elections/{{election_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
