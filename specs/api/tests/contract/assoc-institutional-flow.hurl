# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association institutional memberships CRUD flow: create, list, get, update, delete,
# add seat, list seats, revoke seat.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-inst-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Institutional Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
