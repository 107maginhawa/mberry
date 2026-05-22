# Credit compliance report endpoint. Officer-only.
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── 0. Unauthenticated → 401 ────────────────────────────────

GET {{api}}/credit-compliance/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# ── 1. Auth as officer ───────────────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 2. Get credit compliance report ─────────────────────────

GET {{api}}/credit-compliance/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status >= 200
status < 300
