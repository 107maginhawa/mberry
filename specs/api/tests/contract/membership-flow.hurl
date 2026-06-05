# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-01] [BR-03] [BR-22] [BR-23]
# Membership module contract test: officer creates a category,
# adds a member, lists members, updates status, and manages
# applications. Verifies auth enforcement on all custom routes.
#
# Requires: a seeded org. Uses the test org from db:seed-modules.
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 0. Unauthenticated access → 401 ───────────────────────

# Sign out first to test unauth
# (Hurl cookie jar will be empty after this)
POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200


GET {{api}}/membership/members/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


GET {{api}}/association/member/membership-categories/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# ── Re-authenticate ────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 1. List categories ─────────────────────────────────────
# Route registry mounts GET /association/member/membership-categories (no
# path param — org context comes from the x-org-id header). The
# `/:organizationId` suffix is the PUT/upsert path. Spec previously misused
# the upsert path for the list call → 405 Method Not Allowed.

GET {{api}}/association/member/membership-categories?organizationId={{org_id}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 2. Upsert a new category ──────────────────────────────

PUT {{api}}/association/member/membership-categories/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
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


# ── 5. [BR-23] License number search ──────────────────────

GET {{api}}/membership/members/ed8e3a96-8126-4341-be42-e6eb7940c562?search=PRC
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
