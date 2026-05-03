# Business Rules: [BR-18] [BR-19]
# Credentials module contract test: list credential templates and
# digital credentials (ID cards).
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 0. Unauth → 401 ───────────────────────────────────────

POST {{api}}/auth/sign-out
HTTP 200

GET {{api}}/association/member/credential-templates
HTTP 401

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 1. List credential templates ──────────────────────────

GET {{api}}/association/member/credential-templates
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 2. List digital credentials ───────────────────────────

GET {{api}}/association/member/credentials
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
