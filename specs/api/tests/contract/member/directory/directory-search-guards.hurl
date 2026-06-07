# member/directory — searchDirectory guard contract
#
# Covers operationIds:
#   searchDirectory
# The /association/member/directory/search* prefix is in
# ASSOCIATION_PUBLIC_PATHS (app.ts) so the global org-context middleware
# is bypassed to keep the unauth public projection reachable. The
# searchDirectory handler enforces its own per-call check
# (`if (!orgMembership) → 403 "Organization membership required"`).
#
# Locks the current behavior — searchDirectory always returns 403 from
# a generic per-route auth path because orgMembership is never set on
# the public-prefix request lifecycle. The trust-enriched member search
# flow is expected to migrate to a non-public sub-route in a follow-up;
# this contract pins the regression edge until then.

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Unauthenticated searchDirectory → 401 (per-route bearerAuth) ────────
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

# ── 2. Authenticated searchDirectory on public prefix → 403 ────────────────
#       Handler check rejects when orgMembership is unset (public bypass).
GET {{api}}/association/member/directory/search?limit=5
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 403
[Asserts]
jsonpath "$.error" == "Organization membership required"

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

# ── 4. Member also hits 403 on public-prefix path (same guard) ─────────────
GET {{api}}/association/member/directory/search?limit=5&specialty=Endodontics
Origin: {{origin}}
Cookie: better-auth.session_token={{member_cookie}}
x-org-id: {{org_id}}
HTTP 403
[Asserts]
jsonpath "$.error" == "Organization membership required"
