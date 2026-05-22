# Association licenses CRUD flow: create, list, get, update, delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-licenses-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Licenses Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Licenses",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE license.
POST {{api}}/association/member/licenses
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "licenseNumber": "PRC-{{suffix}}",
  "licenseType": "dental",
  "issuedDate": "2025-01-01T00:00:00Z",
  "expiryDate": "2028-01-01T00:00:00Z",
  "issuingBody": "PRC"
}
HTTP 201
[Captures]
license_id: jsonpath "$.id"


# 2. LIST licenses.
GET {{api}}/association/member/licenses
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET license by ID.
GET {{api}}/association/member/licenses/{{license_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE license.
PATCH {{api}}/association/member/licenses/{{license_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "expiryDate": "2029-01-01T00:00:00Z"
}
HTTP 200


# 5. DELETE license.
DELETE {{api}}/association/member/licenses/{{license_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/member/licenses
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401
