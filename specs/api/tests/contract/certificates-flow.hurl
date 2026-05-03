# Business Rules: [BR-20]
# Certificates module contract test: member views certificates.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── Unauth → 401 ──────────────────────────────────────────

POST {{api}}/auth/sign-out
HTTP 200

GET {{api}}/certificates/my
HTTP 401

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── List my certificates ──────────────────────────────────

GET {{api}}/certificates/my
HTTP 200
