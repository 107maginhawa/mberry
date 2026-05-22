# Association credential templates CRUD flow: create, list, get, update, delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-cred-tpl-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Credential Templates Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "CredTemplates",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE credential template.
POST {{api}}/association/member/credential-templates
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "Member ID Card {{suffix}}",
  "description": "Standard membership identification card",
  "type": "id-card"
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"


# 2. LIST credential templates.
GET {{api}}/association/member/credential-templates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET credential template by ID.
GET {{api}}/association/member/credential-templates/{{template_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE credential template.
PATCH {{api}}/association/member/credential-templates/{{template_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated ID card template"
}
HTTP 200


# 5. DELETE credential template.
DELETE {{api}}/association/member/credential-templates/{{template_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/member/credential-templates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401
