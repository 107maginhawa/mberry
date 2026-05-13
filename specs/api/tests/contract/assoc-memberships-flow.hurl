# Association memberships CRUD flow: create, list, get, update,
# action endpoints (reinstate, renew, terminate), then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-member-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Membership Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Membership",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE membership.
POST {{api}}/association/member/memberships
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "status": "active"
}
HTTP 201
[Captures]
membership_id: jsonpath "$.id"


# 2. LIST memberships.
GET {{api}}/association/member/memberships
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET membership by ID.
GET {{api}}/association/member/memberships/{{membership_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE membership.
PATCH {{api}}/association/member/memberships/{{membership_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "status": "inactive"
}
HTTP 200


# 5. Reinstate membership.
POST {{api}}/association/member/memberships/{{membership_id}}/reinstate
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. Renew membership.
POST {{api}}/association/member/memberships/{{membership_id}}/renew
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 7. Terminate membership.
POST {{api}}/association/member/memberships/{{membership_id}}/terminate
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "reason": "Contract test termination"
}
HTTP 200


# 8. DELETE membership.
DELETE {{api}}/association/member/memberships/{{membership_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 9. 401 — request without auth cookie.
GET {{api}}/association/member/memberships/{{membership_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401


# 10. 404 — fake UUID.
GET {{api}}/association/member/memberships/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
