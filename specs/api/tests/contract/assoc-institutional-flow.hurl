# Association institutional memberships CRUD flow: create, list, get, update, delete,
# add seat, list seats, revoke seat.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-inst-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Institutional Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Institutional",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE institutional membership.
POST {{api}}/association/member/institutional-memberships
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "institutionName": "Test Hospital {{suffix}}",
  "maxSeats": 10
}
HTTP 201
[Captures]
inst_id: jsonpath "$.id"


# 2. LIST institutional memberships.
GET {{api}}/association/member/institutional-memberships
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET institutional membership by ID.
GET {{api}}/association/member/institutional-memberships/{{inst_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE institutional membership.
PATCH {{api}}/association/member/institutional-memberships/{{inst_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "maxSeats": 20
}
HTTP 200


# 5. Add seat allocation.
POST {{api}}/association/member/institutional-memberships/{{inst_id}}/seats
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}"
}
HTTP 201
[Captures]
seat_id: jsonpath "$.id"


# 6. List seat allocations.
GET {{api}}/association/member/institutional-memberships/{{inst_id}}/seats
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. Revoke seat allocation.
POST {{api}}/association/member/institutional-memberships/{{inst_id}}/seats/{{seat_id}}/revoke
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 8. DELETE institutional membership.
DELETE {{api}}/association/member/institutional-memberships/{{inst_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 9. 401 — request without auth cookie.
GET {{api}}/association/member/institutional-memberships
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401


# 10. 404 — fake UUID.
GET {{api}}/association/member/institutional-memberships/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
