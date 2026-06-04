# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-43]
# Voting Only When Election Status Is votingOpen
#
# Source: services/api-ts/src/handlers/elections/castVote.ts:29
#   if (election.status !== 'votingOpen') throw new ConflictError('Voting is not open')
#
# Contract: POST /association/member/ballots must reject any vote against an
# election whose status is not votingOpen with HTTP 409 (ConflictError).
# This is the wire-level proof of the M12 election integrity guard.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562 and a draft
# election ID seeded by layer-6-states.ts (status='draft').

# 0. Auth setup.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "br43-voting-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "BR-43 Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
