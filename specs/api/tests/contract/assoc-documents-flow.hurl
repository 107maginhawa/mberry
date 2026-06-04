# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association documents CRUD flow: create, list, get, update, archive,
# access-log, versions, then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-docs-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Docs Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Docs",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE document.
POST {{api}}/association/documents
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Test Document {{suffix}}",
  "description": "Contract test document",
  "category": "general"
}
HTTP 201
[Captures]
document_id: jsonpath "$.id"


# 2. LIST documents.
GET {{api}}/association/documents
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET document by ID.
GET {{api}}/association/documents/{{document_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE document.
PATCH {{api}}/association/documents/{{document_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated document description"
}
HTTP 200


# 5. Access log.
GET {{api}}/association/documents/{{document_id}}/access-log
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. List versions.
GET {{api}}/association/documents/{{document_id}}/versions
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. Upload version.
POST {{api}}/association/documents/{{document_id}}/versions
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "notes": "Version 2 upload"
}
HTTP 201
[Captures]
version_id: jsonpath "$.id"


# 8. Get version by ID.
GET {{api}}/association/documents/{{document_id}}/versions/{{version_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 9. Archive document.
POST {{api}}/association/documents/{{document_id}}/archive
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 10. DELETE document.
DELETE {{api}}/association/documents/{{document_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 11. 401 — request without auth cookie.
GET {{api}}/association/documents
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 12. 404 — get deleted document.
GET {{api}}/association/documents/{{document_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
