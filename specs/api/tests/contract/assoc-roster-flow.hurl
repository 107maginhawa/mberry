# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association roster flow: list, create, bulk import, get, update.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-roster-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Roster Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Roster",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. LIST roster (may be empty).
GET {{api}}/association/member/roster
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. CREATE roster entry.
POST {{api}}/association/member/roster
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "status": "active"
}
HTTP 201
[Captures]
member_id: jsonpath "$.id"


# 3. Bulk import roster.
POST {{api}}/association/member/roster/import
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "entries": []
}
HTTP 200


# 4. GET roster member by ID.
GET {{api}}/association/member/roster/{{member_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 5. UPDATE roster member.
PUT {{api}}/association/member/roster/{{member_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "status": "inactive"
}
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/member/roster
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 7. 404 — fake UUID.
GET {{api}}/association/member/roster/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
