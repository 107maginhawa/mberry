# member/chapters — RBAC contracts (401 + 403)
#
# Locks the authorization edges of the chapters surface:
#   - Unauthenticated callers get 401 on mutating endpoints.
#   - A signed-in non-admin user gets 403 on chapter-affiliation create.

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Unauthenticated POST → 401 ──────────────────────────────────────────
POST {{api}}/association/member/chapter-affiliations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "00000000-0000-0000-0000-000000000000",
  "chapterId": "00000000-0000-0000-0000-000000000000",
  "isPrimary": false
}
HTTP 401

# ── 1. Unauthenticated POST royalty-split → 401 ────────────────────────────
POST {{api}}/association/member/royalty-splits
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "chapterId": "00000000-0000-0000-0000-000000000000",
  "nationalPercentage": 50,
  "chapterPercentage": 50
}
HTTP 401

# ── 2. Sign up a fresh user (no admin role) ────────────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "chaff-nonadmin-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Nonadmin {{suffix}}"
}
HTTP 200
[Captures]
nonadmin_cookie: cookie "better-auth.session_token"

# ── 3. Non-admin POST chapter-affiliation → 403 ────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/chapter-affiliations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{nonadmin_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "00000000-0000-0000-0000-000000000000",
  "chapterId": "00000000-0000-0000-0000-000000000000",
  "isPrimary": false
}
HTTP 403

# ── 4. Non-admin POST royalty-split → 403 ──────────────────────────────────
POST {{api}}/association/member/royalty-splits
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{nonadmin_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "chapterId": "00000000-0000-0000-0000-000000000000",
  "nationalPercentage": 50,
  "chapterPercentage": 50
}
HTTP 403
