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
Content-Type: application/json
{
  "email": "br43-voting-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "BR-43 Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "BR43",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "Asia/Manila"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. Create an election (defaults to status='draft').
POST {{api}}/association/member/elections
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "BR-43 Contract Election {{suffix}}",
  "description": "Voting guard test",
  "type": "officer",
  "votingMode": "online"
}
HTTP 201
[Captures]
election_id: jsonpath "$.id"


# 2. [BR-43] Attempt to cast a ballot while election is still draft.
#    The handler must reject with 409 ConflictError ('Voting is not open').
POST {{api}}/association/member/ballots
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "electionId": "{{election_id}}",
  "positionId": "00000000-0000-4000-8000-000000000001",
  "nomineeId":  "00000000-0000-4000-8000-000000000002"
}
HTTP 409


# 3. Cleanup.
DELETE {{api}}/association/member/elections/{{election_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
