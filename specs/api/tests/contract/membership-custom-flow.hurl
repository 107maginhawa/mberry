# Membership org profile endpoints.
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── 0. Unauthenticated → 401 ────────────────────────────────

GET {{api}}/membership/org-profile/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# ── 1. Auth as officer ───────────────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
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
Content-Type: application/json
{
  "description": "Updated by contract test {{suffix}}"
}
HTTP *
[Asserts]
status >= 200
status < 300
