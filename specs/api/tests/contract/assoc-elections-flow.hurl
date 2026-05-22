# Association elections CRUD flow: create election, list, get, update,
# action endpoints (certify, open-nominations, open-voting), then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-elections-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Elections Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Elections",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE election.
POST {{api}}/association/member/elections
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Board Election {{suffix}}",
  "description": "Annual board election",
  "startDate": "2026-06-01T00:00:00Z",
  "endDate": "2026-06-30T00:00:00Z"
}
HTTP 201
[Captures]
election_id: jsonpath "$.id"


# 2. LIST elections.
GET {{api}}/association/member/elections
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET election by ID.
GET {{api}}/association/member/elections/{{election_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE election.
PATCH {{api}}/association/member/elections/{{election_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated board election description"
}
HTTP 200


# 5. Certify election.
POST {{api}}/association/member/elections/{{election_id}}/certify
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. Open nominations.
POST {{api}}/association/member/elections/{{election_id}}/open-nominations
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 7. Open voting.
POST {{api}}/association/member/elections/{{election_id}}/open-voting
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 8. DELETE election.
DELETE {{api}}/association/member/elections/{{election_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 9. 401 — request without auth cookie.
GET {{api}}/association/member/elections
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401
