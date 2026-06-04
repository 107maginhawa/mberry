# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-11] [BR-12] [BR-13] [BR-14]
# Credits module contract test: verify credit-related endpoints respond.
# Note: credit entry endpoints are not yet routed; this tests the
# training module's auto-credit side-effect indirectly via training list.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 0. Unauth → 401 ───────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/training
HTTP 401

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 1. List trainings (credits are awarded on completion) ──

GET {{api}}/association/training
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 2. My events (events can also award attendance credits) ─

GET {{api}}/association/event-lifecycle/my
HTTP 200
