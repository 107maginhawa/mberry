# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association document tags CRUD flow: create, list, get, update, delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-doctags-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "DocTags Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "DocTags",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE tag.
POST {{api}}/association/document-tags
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "Test Tag {{suffix}}",
  "color": "#FF5733"
}
HTTP 201
[Captures]
tag_id: jsonpath "$.id"


# 2. LIST tags.
GET {{api}}/association/document-tags
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET tag by ID.
GET {{api}}/association/document-tags/{{tag_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE tag.
PATCH {{api}}/association/document-tags/{{tag_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "Updated Tag {{suffix}}"
}
HTTP 200


# 5. DELETE tag.
DELETE {{api}}/association/document-tags/{{tag_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/document-tags
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 7. 404 — get deleted tag.
GET {{api}}/association/document-tags/{{tag_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
