# Association applications CRUD flow: create, list, get, update,
# approve/deny actions, then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-app-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Application Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Application",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE application.
POST {{api}}/association/member/applications
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "type": "new"
}
HTTP 201
[Captures]
application_id: jsonpath "$.id"


# 2. LIST applications.
GET {{api}}/association/member/applications
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET application by ID.
GET {{api}}/association/member/applications/{{application_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE application.
PATCH {{api}}/association/member/applications/{{application_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "type": "renewal"
}
HTTP 200


# 5. Approve application.
POST {{api}}/association/member/applications/{{application_id}}/approve
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. Create another application to test deny.
POST {{api}}/association/member/applications
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "type": "new"
}
HTTP 201
[Captures]
application_id_2: jsonpath "$.id"


# 7. Deny application.
POST {{api}}/association/member/applications/{{application_id_2}}/deny
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "reason": "Contract test denial"
}
HTTP 200


# 8. DELETE application.
DELETE {{api}}/association/member/applications/{{application_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 9. 401 — request without auth cookie.
GET {{api}}/association/member/applications/{{application_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 10. 404 — fake UUID.
GET {{api}}/association/member/applications/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
