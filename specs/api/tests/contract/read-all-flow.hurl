# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Mark all notifications as read endpoint.

# ── 0. Unauthenticated → 401 ────────────────────────────────

POST {{api}}/notifs/read-all
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 401


# ── 1. Auth ──────────────────────────────────────────────────

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "readall-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "ReadAll Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

POST {{api}}/notifs/read-all
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP *
[Asserts]
status >= 200
status < 300
