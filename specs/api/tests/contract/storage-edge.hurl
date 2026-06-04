# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Storage edge cases: 50MB cap, missing-file 404 on download, can't
# download a file still in `uploading` status, non-owner can't fetch
# someone else's file, special chars in filename are preserved.

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "storage-edge-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Storage Edge"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

GET {{api}}/storage/files/{{pending_file}}/download
HTTP *
[Asserts]
status >= 400
status < 500


# 5. Filenames with special characters round-trip through metadata.
POST {{api}}/storage/files/upload
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "filename": "Anaïs's résumé (final v2).pdf",
  "size": 42,
  "mimeType": "application/pdf"
}
HTTP 201
[Captures]
special_file: jsonpath "$.file"


GET {{api}}/storage/files/{{special_file}}
HTTP 200
[Asserts]
jsonpath "$.filename" == "Anaïs's résumé (final v2).pdf"


# 6. Another user cannot read someone else's file metadata.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "storage-other-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Storage Other"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

GET {{api}}/storage/files/{{special_file}}
HTTP *
[Asserts]
status >= 401
status <= 404
