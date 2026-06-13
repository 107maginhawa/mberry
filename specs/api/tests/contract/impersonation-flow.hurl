# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-10]
# Impersonation RBAC contract test (AHA FIX-017 — tightened from the prior
# "status < 500 / route is wired and doesn't crash" tolerance).
#
# The seeded Vice President (vicepresident@memberry.ph) is an ORG OFFICER, NOT a
# platform admin — not present in the platform_admin table. (The President
# test@memberry.ph IS a seeded `super` platform_admin — see seed/layer-2-users.ts
# `seedPresident`, load-bearing for admin-flow.hurl + admin E2E — so she is
# unsuitable as the non-admin subject here.) The /admin/* surface is guarded by
# `app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware())`
# (app.ts), so every /admin/impersonate call by this non-admin user MUST be
# rejected with 403 (ForbiddenError "User is not a platform admin"). We now
# assert that real RBAC behavior instead of merely "did not 500".
#
# NOTE: [BLOCKED BY ENVIRONMENT] — not executed during the AHA fix pass (no API
# server boot available). Run via scripts/run-contract-tests.ts against $API_URL.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in ─────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "vicepresident@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── [BR-10] Non-admin is rejected by the /admin guard (403) ──────────
# Officer (non platform admin) → platformAdminAuthMiddleware throws 403.

POST {{api}}/admin/impersonate
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "userId": "00000000-0000-0000-0000-000000000000"
}
HTTP 403


# ── [BR-10] End impersonation is also guarded for non-admins (403) ──────────

POST {{api}}/admin/impersonate/00000000-0000-0000-0000-000000000000/end
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 403
