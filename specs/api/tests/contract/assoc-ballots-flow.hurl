# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association ballots flow: cast ballot, list ballots.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-ballots-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Ballots Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
