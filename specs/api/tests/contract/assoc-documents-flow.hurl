# Association documents CRUD flow: officer creates a document (draft),
# lists, gets, updates, archives, reads access log, uploads a new version,
# lists + gets versions, then deletes.
#
# Covers operationIds:
#   createDocument, searchDocuments, getDocument, updateDocument,
#   archiveDocument, getDocumentAccessLog, uploadNewDocumentVersion,
#   listDocumentVersions, getDocumentVersion, deleteDocument
#
# Requires: seeded org + officer (test@memberry.ph) from db:seed-modules.
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# CSRF preamble
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── Auth: sign in as officer ──────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"
officer_user_id: jsonpath "$.user.id"

# ── 0. Unauthenticated → 401 ─────────────────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/documents
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

# ── Re-authenticate ───────────────────────────────────────────────────────────

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"
officer_user_id: jsonpath "$.user.id"

# ── 1. Search documents (baseline) ───────────────────────────────────────────

GET {{api}}/association/documents
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 2. Create a document (officer, org-owned) ────────────────────────────────

POST {{api}}/association/documents
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Contract Test Policy",
  "fileName": "policy.pdf",
  "mimeType": "application/pdf",
  "size": 4096,
  "storageKey": "test/contract/policy-{{suffix}}.pdf",
  "ownerId": "ed8e3a96-8126-4341-be42-e6eb7940c562",
  "ownerType": "organization",
  "accessLevel": "tenantOnly",
  "category": "policy",
  "tags": ["contract-test"],
  "status": "draft"
}
HTTP 201
[Captures]
document_id: jsonpath "$.id"
[Asserts]
jsonpath "$.title" == "Contract Test Policy"
jsonpath "$.status" == "draft"

# ── 3. Get the document ──────────────────────────────────────────────────────

GET {{api}}/association/documents/{{document_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{document_id}}"
jsonpath "$.title" == "Contract Test Policy"

# ── 4. Update the document ───────────────────────────────────────────────────

PATCH {{api}}/association/documents/{{document_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Contract Test Policy (updated)",
  "tags": ["contract-test", "updated"]
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{document_id}}"
jsonpath "$.title" == "Contract Test Policy (updated)"

# ── 5. Upload a new version ──────────────────────────────────────────────────

POST {{api}}/association/documents/{{document_id}}/versions
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "fileName": "policy-v2.pdf",
  "size": 5120,
  "storageKey": "test/contract/policy-{{suffix}}-v2.pdf",
  "changeNotes": "Reflowed page 3"
}
HTTP 201
[Captures]
version_id: jsonpath "$.id"
[Asserts]
jsonpath "$.documentId" == "{{document_id}}"
jsonpath "$.versionNumber" >= 1

# ── 6. List versions ─────────────────────────────────────────────────────────

GET {{api}}/association/documents/{{document_id}}/versions
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 7. Get a single version ──────────────────────────────────────────────────

GET {{api}}/association/documents/{{document_id}}/versions/{{version_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{version_id}}"
jsonpath "$.documentId" == "{{document_id}}"

# ── 8. Get access log ────────────────────────────────────────────────────────

GET {{api}}/association/documents/{{document_id}}/access-log
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 9. Archive the document ──────────────────────────────────────────────────

POST {{api}}/association/documents/{{document_id}}/archive
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{document_id}}"
jsonpath "$.status" == "archived"

# ── 10. Delete the document ──────────────────────────────────────────────────

DELETE {{api}}/association/documents/{{document_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 204
