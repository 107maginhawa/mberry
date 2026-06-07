# member/chapters — royalty split CRUD + sum-to-100 constraint
#
# Covers operationIds:
#   createRoyaltySplit, getRoyaltySplit, listRoyaltySplits,
#   updateRoyaltySplit, deleteRoyaltySplit
# Real flow: officer creates a split where splitPercentNational +
# splitPercentChapter sums to 100, verifies persistence, mutates, deletes.
# Then verifies the domain rule rejecting a split that doesn't sum to 100.

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

# Capture an existing membership id (royalty split is a per-membership rule).
GET {{api}}/association/member/memberships?limit=1
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Captures]
membership_id: jsonpath "$.data[0].id"

# ── 1. Create royalty split — happy path (60 + 40 = 100) ───────────────────
POST {{api}}/association/member/royalty-splits
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "membershipId": "{{membership_id}}",
  "nationalOrgId": "{{org_id}}",
  "chapterId": "c5b0ed2c-1a51-4445-b548-416df7d27415",
  "splitPercentNational": 60,
  "splitPercentChapter": 40,
  "effectiveDate": "2026-01-01"
}
HTTP 201
[Captures]
split_id: jsonpath "$.id"

# ── 2. GET resolves the row ────────────────────────────────────────────────
GET {{api}}/association/member/royalty-splits/{{split_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{split_id}}"

# ── 3. LIST filtered by chapterId includes the row ─────────────────────────
GET {{api}}/association/member/royalty-splits?chapterId=c5b0ed2c-1a51-4445-b548-416df7d27415
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data[?(@.id=='{{split_id}}')]" exists

# ── 4. PATCH rebalances (still sums to 100) ────────────────────────────────
PATCH {{api}}/association/member/royalty-splits/{{split_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "splitPercentNational": 70,
  "splitPercentChapter": 30
}
HTTP 200

# ── 5. Reject create where sum ≠ 100 ───────────────────────────────────────
POST {{api}}/association/member/royalty-splits
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "membershipId": "{{membership_id}}",
  "nationalOrgId": "{{org_id}}",
  "chapterId": "c5b0ed2c-1a51-4445-b548-416df7d27415",
  "splitPercentNational": 40,
  "splitPercentChapter": 40,
  "effectiveDate": "2026-01-01"
}
HTTP 422

# ── 6. DELETE row gone ─────────────────────────────────────────────────────
DELETE {{api}}/association/member/royalty-splits/{{split_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 204

GET {{api}}/association/member/royalty-splits/{{split_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 404
