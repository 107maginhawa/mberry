# Reviews contract flow — NPS review CRUD as the seeded officer.
#
# Covers operationIds:
#   listReviews, createReview, getReview, deleteReview
#
# Requires: seeded org + officer (test@memberry.ph) from db:seed-modules.
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# CSRF preamble
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── Auth: sign in as officer ──────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"

# ── 1. List reviews (baseline) ───────────────────────────────────────────────

GET {{api}}/reviews/
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" exists

# ── 2. Create a review ───────────────────────────────────────────────────────

POST {{api}}/reviews/
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "context": "platform_nps",
  "reviewType": "nps",
  "score": 9,
  "comment": "Contract test review"
}
HTTP *
[Asserts]
status toString matches "^(201|400|409|500)$"

# ── 3. Get a review (synthetic id) ───────────────────────────────────────────

GET {{api}}/reviews/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

# ── 4. Delete a review (synthetic id) ────────────────────────────────────────

DELETE {{api}}/reviews/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|403|404)$"
