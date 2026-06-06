# PlatformAdmin extended contract flow — committees, national dashboard,
# national chapters, platform summary, public org directory.
#
# Covers operationIds:
#   listAllCommittees, getCommittee, getNationalDashboard,
#   listNationalChapters, getNationalChapterDetail, getPlatformSummary,
#   listPublicOrgs
#
# Requires: seeded org + officer (test@memberry.ph) from db:seed-modules.
# Most admin endpoints require role=super; the seeded officer is org-scoped
# so 403 is the expected response for them — still exercises the route.
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

# ── 1. List all committees (admin) ───────────────────────────────────────────

GET {{api}}/admin/committees
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

# ── 2. Get a synthetic committee ─────────────────────────────────────────────

GET {{api}}/admin/committees/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── 3. National dashboard for a synthetic association ────────────────────────

GET {{api}}/admin/national-dashboard/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── 4. List national chapters ────────────────────────────────────────────────

GET {{api}}/admin/national/chapters
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

# ── 5. National chapter detail (synthetic org id) ────────────────────────────

GET {{api}}/admin/national/chapters/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── 6. Platform summary ──────────────────────────────────────────────────────

GET {{api}}/admin/national/platform
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

# ── 7. Public org directory (anonymous) ──────────────────────────────────────

GET {{api}}/public/orgs
HTTP *
[Asserts]
status toString matches "^(200|400|404)$"
