# Association ballots flow: cast ballot, list ballots.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-ballots-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Ballots Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Ballots",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE ballot (cast vote).
POST {{api}}/association/member/ballots
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "candidateId": "00000000-0000-0000-0000-000000000001",
  "electionId": "00000000-0000-0000-0000-000000000001"
}
HTTP 201


# 2. LIST ballots.
GET {{api}}/association/member/ballots
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. 401 — request without auth cookie.
GET {{api}}/association/member/ballots
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
