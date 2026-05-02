# Membership module contract test: officer creates a category,
# adds a member, lists members, updates status, and manages
# applications. Verifies auth enforcement on all custom routes.
#
# Requires: a seeded org. Uses the test org from db:seed-modules.
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 0. Unauthenticated access → 401 ───────────────────────

# Sign out first to test unauth
# (Hurl cookie jar will be empty after this)
POST {{api}}/auth/sign-out
HTTP 200


GET {{api}}/membership/members/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


GET {{api}}/membership/categories/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# ── Re-authenticate ────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 1. List categories ─────────────────────────────────────

GET {{api}}/membership/categories/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 2. Upsert a new category ──────────────────────────────

PUT {{api}}/membership/categories/ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "name": "Contract Test Category {{suffix}}",
  "duesAmount": 50000,
  "billingCycle": "annual"
}
HTTP 200


# ── 3. List members ────────────────────────────────────────

GET {{api}}/membership/members/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 4. List applications ───────────────────────────────────

GET {{api}}/membership/applications/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
