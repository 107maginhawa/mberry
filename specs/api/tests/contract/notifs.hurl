# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Notification list + mark-all-as-read on a brand new user (no notifications).
# The list endpoint should accept the request, return an empty paginated
# envelope, and survive mark-all-as-read as a no-op.

# 0. Unauthenticated list must be rejected. Run before any sign-up so
# Hurl's session cookie jar is empty.
GET {{api}}/notifs
HTTP 401


POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "notifs-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Notifs Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
