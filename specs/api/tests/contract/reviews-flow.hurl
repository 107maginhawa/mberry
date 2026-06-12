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

# ── 1. List reviews (baseline) — FIX-011 org-scoped read ─────────────────────
# The officer carries org context (x-org-id), so listReviews is now scoped to
# the caller's org instead of leaking cross-org rows.

GET {{api}}/reviews/
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" exists

# ── 2. Create a real review → capture id ─────────────────────────────────────
# Contract shape: { context: UUID, reviewType, npsScore: 0-10, comment? }.
# reviewType is unique per run (suffix) to satisfy the (context, reviewer,
# reviewType) unique constraint across repeated contract runs.

POST {{api}}/reviews/
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "context": "11111111-1111-4111-8111-111111111111",
  "reviewType": "nps-{{suffix}}",
  "npsScore": 9,
  "comment": "Batch D audit proof"
}
HTTP 201
[Captures]
review_id: jsonpath "$.id"

# ── 3. Get the review back (positive read) ───────────────────────────────────

GET {{api}}/reviews/{{review_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{review_id}}"

# ── 4. Delete the review (owner) ─────────────────────────────────────────────

DELETE {{api}}/reviews/{{review_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 204

# ── 5. FIX-012: the deleteReview x-audit extension emitted an audit row ───────
# Sign in as admin (cross-org read access to /audit/logs) and assert a `delete`
# audit event exists for the just-deleted review. This is the live proof that
# the @extension("x-audit", #{ action: "delete", resourceType: "review" }) on
# deleteReview composes a real per-route audit event.

GET {{api}}/csrf-token
HTTP 200
[Captures]
admin_csrf: jsonpath "$.token"

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{admin_csrf}}
Content-Type: application/json
{
  "email": "{{admin_email}}",
  "password": "{{admin_password}}"
}
HTTP 200
[Captures]
admin_cookie: cookie "better-auth.session_token"

GET {{api}}/audit/logs?resource={{review_id}}&action=delete
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 1
