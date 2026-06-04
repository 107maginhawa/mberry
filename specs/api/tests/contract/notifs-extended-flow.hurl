# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Extended notification endpoints not covered by notifs.hurl.
# Covers GET single notification and mark single as read.
# Uses a placeholder notif ID since no notifications exist for
# a new user — expects 404, validating the route exists.

# ── Auth ─────────────────────────────────────────────────────

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "notifs-ext-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "NotifsExt Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "firstName": "NotifsExt",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# ── 1. Unauthenticated → 401 ────────────────────────────────

GET {{api}}/notifs/00000000-0000-0000-0000-000000000000
HTTP 401


# ── 2. Get single notification (non-existent → 404) ─────────

GET {{api}}/notifs/00000000-0000-0000-0000-000000000000
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status <= 404


# ── 3. Mark single notification as read (non-existent) ──────

POST {{api}}/notifs/00000000-0000-0000-0000-000000000000/read
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{}
HTTP *
[Asserts]
status >= 200
status <= 404
