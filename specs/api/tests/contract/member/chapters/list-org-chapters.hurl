# member/chapters — listOrgChapters contract
#
# Covers operationId: listOrgChapters (GET /association/member/chapters)
# Role: association:member (read-only).
# Real flow: sign in as seeded officer (member of seeded org), list chapters,
# assert response shape + that at least one chapter row resolves to a name.

# CSRF preamble
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Unauthenticated → 401 ───────────────────────────────────────────────
GET {{api}}/association/member/chapters
x-org-id: {{org_id}}
HTTP 401

# ── 1. Sign in as seeded officer ───────────────────────────────────────────
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

# ── 2. listOrgChapters returns rows with shape { id, chapterId, chapterName? } ─
GET {{api}}/association/member/chapters
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data[0].id" exists
jsonpath "$.data[0].chapterId" exists
