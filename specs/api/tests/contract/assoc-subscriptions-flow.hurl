# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association subscription topics and person subscriptions flow:
# create topic, get, update, delete, list person subs, bulk update, update sub.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-subs-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Subs Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
