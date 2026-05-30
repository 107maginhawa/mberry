# Association dunning flow: list events, run dunning, template CRUD.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-dunn-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dunning Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Dunning",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. LIST dunning events.
GET {{api}}/association/member/dunning/events
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. Run dunning.
POST {{api}}/association/member/dunning/run
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 3. CREATE dunning template.
POST {{api}}/association/member/dunning/templates
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "Overdue Notice {{suffix}}",
  "subject": "Your dues are overdue",
  "body": "Please pay your outstanding dues."
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"


# 4. LIST dunning templates.
GET {{api}}/association/member/dunning/templates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 5. GET dunning template by ID.
GET {{api}}/association/member/dunning/templates/{{template_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. UPDATE dunning template.
PATCH {{api}}/association/member/dunning/templates/{{template_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "subject": "Updated: Your dues are overdue"
}
HTTP 200


# 7. DELETE dunning template.
DELETE {{api}}/association/member/dunning/templates/{{template_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 8. 401 — request without auth cookie.
GET {{api}}/association/member/dunning/events
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 9. 404 — fake UUID.
GET {{api}}/association/member/dunning/templates/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
