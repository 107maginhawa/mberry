# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Membership org profile endpoints.
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── 0. Unauthenticated → 401 ────────────────────────────────

GET {{api}}/membership/org-profile/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# ── 1. Auth as officer ───────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 2. Get org profile ──────────────────────────────────────

GET {{api}}/membership/org-profile/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status >= 200
status < 300


# ── 3. Update org profile ───────────────────────────────────

PUT {{api}}/membership/org-profile/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "description": "Updated by contract test {{suffix}}"
}
HTTP *
[Asserts]
status >= 200
status < 300
