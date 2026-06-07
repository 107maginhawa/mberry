# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



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
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "br50-dates-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "BR-50 Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
