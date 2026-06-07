# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Person profile lifecycle: sign-up -> create person -> read -> update.
# Asserts the response shape of the Person model is what the OpenAPI says.

# 1. Sign up
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "person-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Person Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
user_id: jsonpath "$.user.id"


# 2. Person profile is auto-created on sign-up — POST /persons now 409s.
# Capture person_id from the user.id (1:1 relationship per auth.ts:201).
# Define alias for backward compatibility with the rest of this spec.
GET {{api}}/persons/{{user_id}}
HTTP 200
[Captures]
person_id: jsonpath "$.id"
[Asserts]
jsonpath "$.id" == "{{user_id}}"
jsonpath "$.firstName" exists


# 3. Read it back (idempotent — covered by step 2, kept for shape contract).
GET {{api}}/persons/{{person_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{person_id}}"
jsonpath "$.firstName" exists


# 4. Patch it — update the auto-created firstName.
PATCH {{api}}/persons/{{person_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Augusta",
  "lastName": "Lovelace"
}
HTTP 200
[Asserts]
jsonpath "$.firstName" == "Augusta"
jsonpath "$.lastName" == "Lovelace"
