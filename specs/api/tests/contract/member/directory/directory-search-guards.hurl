# member/directory — searchDirectory guard contract
#
# Covers operationIds:
#   searchDirectory
#
# Only the per-person public projection
# (`/association/member/directory/search/:personId/public`) is public;
# the bare `/association/member/directory/search` is the AUTHENTICATED
# member directory search and flows through auth + org-context middleware.
# Behavior:
#   - unauthenticated            → 401
#   - authenticated org member   → 200 (trust-enriched results)
#   - authenticated non-member   → 403 "Not a member of this organization"
#     (org-context middleware, before the handler runs)

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Unauthenticated searchDirectory → 401 (per-route auth) ──────────────
GET {{api}}/association/member/directory/search?limit=5
Origin: {{origin}}
HTTP 401

# ── 1. Sign in as admin / officer ──────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"

# ── 2. Authenticated org member (officer) searchDirectory → 200 ────────────
#       org-context middleware resolves the membership and sets orgMembership.
GET {{api}}/association/member/directory/search?limit=5
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" exists
jsonpath "$.pagination" exists

# ── 3. Sign in as seed member01 ────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "member01@memberry.ph",
  "password": "{{seed_officer_password}}"
}
HTTP 200
[Captures]
member_cookie: cookie "better-auth.session_token"

# ── 4. Org member searchDirectory with a filter → 200 ──────────────────────
GET {{api}}/association/member/directory/search?limit=5&specialty=Endodontics
Origin: {{origin}}
Cookie: better-auth.session_token={{member_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" exists

# ── 5. Sign up a fresh user with no membership in the org ──────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "dir-nonmember-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Dir NonMember {{suffix}}"
}
HTTP 200
[Captures]
nonmember_cookie: cookie "better-auth.session_token"

# ── 6. Non-member searchDirectory → 403 (org-context guard) ────────────────
GET {{api}}/association/member/directory/search?limit=5
Origin: {{origin}}
Cookie: better-auth.session_token={{nonmember_cookie}}
x-org-id: {{org_id}}
HTTP 403
