# member/directory — RBAC contracts (401 + 403)
#
# Locks authorization edges:
#   - Unauthenticated callers get 401 on mutating endpoints (create/update/delete).
#   - A signed-in non-admin user gets 403 on listDirectoryProfiles (admin-only).
# Public-search endpoints (getPublicDirectoryProfile) stay reachable
# without auth — covered separately in directory-public-view.hurl.

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Unauthenticated createDirectoryProfile → 401 ────────────────────────
POST {{api}}/association/member/directory/profiles
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "00000000-0000-0000-0000-000000000000",
  "displayName": "RBAC Probe {{suffix}}",
  "visibility": "public"
}
HTTP 401

# ── 1. Unauthenticated updateDirectoryProfile → 401 ────────────────────────
PATCH {{api}}/association/member/directory/profiles/00000000-0000-0000-0000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "title": "RBAC Probe"
}
HTTP 401

# ── 2. Unauthenticated deleteDirectoryProfile → 401 ────────────────────────
DELETE {{api}}/association/member/directory/profiles/00000000-0000-0000-0000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
HTTP 401

# ── 3. Sign up a fresh non-admin user ──────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "rbac-dir-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "RBAC Dir Probe {{suffix}}"
}
HTTP 200
[Captures]
plain_user_cookie: cookie "better-auth.session_token"

# ── 4. Non-admin listDirectoryProfiles → 403 (admin role required) ─────────
GET {{api}}/association/member/directory/profiles?limit=10
Origin: {{origin}}
Cookie: better-auth.session_token={{plain_user_cookie}}
x-org-id: {{org_id}}
HTTP 403
