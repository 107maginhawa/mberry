# Association positions CRUD flow: create, list, get, update, delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-positions-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Positions Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Positions",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE position.
POST {{api}}/association/member/positions
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Board Secretary {{suffix}}",
  "description": "Records meeting minutes and manages correspondence",
  "rank": 3
}
HTTP 201
[Captures]
position_id: jsonpath "$.id"


# 2. LIST positions.
GET {{api}}/association/member/positions
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET position by ID.
GET {{api}}/association/member/positions/{{position_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE position.
PATCH {{api}}/association/member/positions/{{position_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated secretary duties"
}
HTTP 200


# 5. DELETE position.
DELETE {{api}}/association/member/positions/{{position_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/member/positions
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
