# Association message templates CRUD flow: create, list, get, update,
# preview, then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-msgtpl-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "MsgTpl Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "MsgTpl",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE message template.
POST {{api}}/association/message-templates
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "Welcome Template {{suffix}}",
  "subject": "Welcome to the association",
  "body": "Hello {{name}}, welcome!",
  "channel": "email"
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"


# 2. LIST message templates.
GET {{api}}/association/message-templates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET message template by ID.
GET {{api}}/association/message-templates/{{template_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE message template.
PATCH {{api}}/association/message-templates/{{template_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "subject": "Updated welcome subject"
}
HTTP 200


# 5. Preview message template.
POST {{api}}/association/message-templates/{{template_id}}/preview
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "variables": {"name": "Test User"}
}
HTTP 200


# 6. DELETE message template.
DELETE {{api}}/association/message-templates/{{template_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. 401 — request without auth cookie.
GET {{api}}/association/message-templates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
