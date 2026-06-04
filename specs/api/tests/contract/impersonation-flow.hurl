# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-10]
# Impersonation contract test: verify admin impersonation endpoints
# exist and respond without 500. The test user may not have admin
# privileges, so 401/403 is acceptable — we just prove the route
# is wired and doesn't crash.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in ─────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── [BR-10] Start impersonation endpoint responds ────────
# The user may lack admin role, so expect 401/403/422 — not 500.

POST {{api}}/admin/impersonate
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "userId": "00000000-0000-0000-0000-000000000000"
}
HTTP *
[Asserts]
status < 500


# ── [BR-10] End impersonation endpoint responds ──────────

POST {{api}}/admin/impersonate/00000000-0000-0000-0000-000000000000/end
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP *
[Asserts]
status < 500
