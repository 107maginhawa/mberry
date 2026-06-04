# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Extended person endpoints not covered by person-lifecycle.hurl.
# Covers /persons list, /persons/me/* preferences, credits, privacy,
# memberships, officer role, export, and deletion flow.

# ── 0. Sign up and create person ─────────────────────────────

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "person-ext-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Person Extended"
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
  "firstName": "Extended",
  "lastName": "Tester",
  "dateOfBirth": "1985-03-20",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# ── 1. List all persons ──────────────────────────────────────

GET {{api}}/persons
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 2. Update self via /me ────────────────────────────────────

PATCH {{api}}/persons/me
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "firstName": "ExtUpdated"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 3. Credit summary ────────────────────────────────────────

GET {{api}}/persons/me/credit-summary
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 4. Credit entries list ───────────────────────────────────

GET {{api}}/persons/me/credit-entries
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 5. Add credit entry ─────────────────────────────────────

POST {{api}}/persons/me/credit-entries
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "title": "Contract Test Credit {{suffix}}",
  "creditHours": 2,
  "dateCompleted": "2026-01-15"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 6. Export my data ────────────────────────────────────────

GET {{api}}/persons/me/export
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 7. My memberships ───────────────────────────────────────

GET {{api}}/persons/me/memberships
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 8. Get notification preferences ─────────────────────────

GET {{api}}/persons/me/notification-preferences
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 9. Update notification preferences ──────────────────────

PATCH {{api}}/persons/me/notification-preferences
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "emailEnabled": true,
  "pushEnabled": false
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 10. Get privacy settings ────────────────────────────────

GET {{api}}/persons/me/privacy
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 11. Update privacy settings ─────────────────────────────

PATCH {{api}}/persons/me/privacy
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "profileVisibility": "members"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 12. Check officer role for org ───────────────────────────

GET {{api}}/persons/me/officer-role/ed8e3a96-8126-4341-be42-e6eb7940c562
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 404


# ── 13. Request account deletion ─────────────────────────────

POST {{api}}/persons/me/delete
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 14. Cancel account deletion ──────────────────────────────

POST {{api}}/persons/me/cancel-delete
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
HTTP *
[Asserts]
status >= 200
status < 300
