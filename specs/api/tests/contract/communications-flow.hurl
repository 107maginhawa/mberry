# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-28]
# Communications (announcements) module contract test.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── Unauth → 401 ──────────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/communications/announcements/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── List announcements ────────────────────────────────────

GET {{api}}/communications/announcements/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── Create announcement ───────────────────────────────────

POST {{api}}/communications/announcements/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Contract Test Announcement {{suffix}}",
  "content": "This is a test announcement for contract testing."
}
HTTP 201
[Captures]
announcement_id: jsonpath "$.data.id"


# ── Get announcement ──────────────────────────────────────

GET {{api}}/communications/announcements/detail/{{announcement_id}}
HTTP 200
