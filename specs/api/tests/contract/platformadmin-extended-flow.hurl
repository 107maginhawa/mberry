# PlatformAdmin extended contract flow — committees, national dashboard,
# national chapters, platform summary, public org directory.
#
# Covers operationIds:
#   listAllCommittees, getCommittee, getNationalDashboard,
#   listNationalChapters, getNationalChapterDetail, getPlatformSummary,
#   listPublicOrgs
#
# Requires: seeded org + officer (test@memberry.ph) from db:seed-modules.
#
# AHA FIX-017 (tightened): the seeded officer is NOT in the platform_admin
# table, and `app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware())`
# (app.ts) guards the whole /admin surface. Every /admin/* call below MUST be
# rejected with a deterministic 403 for this non-admin user. We now assert that
# exact RBAC behavior instead of the prior `matches "^(200|400|403|404)$"`
# tolerance, which also passed on accidental 200/400/404 and masked a broken
# guard. The public org directory (step 7) is unauthenticated and asserts a
# real 200/4xx outcome.
#
# NOTE: [BLOCKED BY ENVIRONMENT] — not executed during the AHA fix pass (no API
# server boot). Run via scripts/run-contract-tests.ts against $API_URL.
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
HTTP 403

# ── 2. Get a synthetic committee ─────────────────────────────────────────────

GET {{api}}/admin/committees/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# ── 3. National dashboard for a synthetic association ────────────────────────

GET {{api}}/admin/national-dashboard/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# ── 4. List national chapters ────────────────────────────────────────────────

GET {{api}}/admin/national/chapters
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# ── 5. National chapter detail (synthetic org id) ────────────────────────────

GET {{api}}/admin/national/chapters/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# ── 6. Platform summary ──────────────────────────────────────────────────────

GET {{api}}/admin/national/platform
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# ── 7. Public org directory (anonymous) ──────────────────────────────────────
# Genuinely public endpoint (listPublicOrgs) — must return 200 for an anonymous
# caller. Tightened from `matches "^(200|400|404)$"`.

GET {{api}}/public/orgs
HTTP 200
[Asserts]
jsonpath "$.data" exists
