# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association credentials CRUD flow: list, issue, verify, get, update,
# revoke, delete. Includes public-verify (no auth).

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-credentials-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Credentials Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Credentials",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. LIST credentials.
GET {{api}}/association/member/credentials
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. Issue credential.
POST {{api}}/association/member/credentials/issue
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "templateId": "00000000-0000-0000-0000-000000000001",
  "issueDate": "2026-01-15T00:00:00Z",
  "expiryDate": "2027-01-15T00:00:00Z"
}
HTTP 201
[Captures]
credential_id: jsonpath "$.id"


# 3. Public verify (no auth needed).
POST {{api}}/association/member/credentials/public-verify
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "credentialId": "{{credential_id}}"
}
HTTP 200


# 4. Verify credential (authenticated).
POST {{api}}/association/member/credentials/verify
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "credentialId": "{{credential_id}}"
}
HTTP 200


# 5. GET credential by ID.
GET {{api}}/association/member/credentials/{{credential_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. UPDATE credential.
PATCH {{api}}/association/member/credentials/{{credential_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "expiryDate": "2028-01-15T00:00:00Z"
}
HTTP 200


# 7. Revoke credential.
POST {{api}}/association/member/credentials/{{credential_id}}/revoke
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "reason": "Contract test revocation"
}
HTTP 200


# 8. DELETE credential.
DELETE {{api}}/association/member/credentials/{{credential_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 9. 401 — request without auth cookie.
GET {{api}}/association/member/credentials
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
