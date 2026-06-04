# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Officer terms summary endpoint.
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── 0. Unauthenticated → 401 ────────────────────────────────

GET {{api}}/officer-terms/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# ── 1. Auth ──────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 2. List officer terms summary ────────────────────────────

GET {{api}}/officer-terms/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status >= 200
status < 300
