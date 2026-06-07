# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-31]
# Storage upload lifecycle: request a presigned upload URL, PUT the file
# bytes directly to the storage backend, complete the upload, list, and
# delete. The presigned URL bypasses the API on the way to S3/MinIO.

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "storage-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Storage Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
