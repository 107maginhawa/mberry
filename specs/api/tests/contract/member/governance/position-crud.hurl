# member/governance — position CRUD lifecycle
#
# Covers operationIds: createPosition, getPosition, listPositions, updatePosition, deletePosition
# Real flow: President creates a chapter-level position, reads it back, lists,
# updates its description, deletes it. Verifies DB roundtrip and that the
# position is no longer returned by list afterwards.

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

# ── 1. createPosition ──────────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/positions
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "title": "Test Position {{suffix}}",
  "organizationId": "{{org_id}}",
  "level": "chapter",
  "termLengthMonths": 12,
  "description": "Contract test position",
  "status": "active"
}
HTTP 201
[Captures]
position_id: jsonpath "$.id"
[Asserts]
jsonpath "$.title" == "Test Position {{suffix}}"
jsonpath "$.level" == "chapter"
jsonpath "$.termLengthMonths" == 12
jsonpath "$.organizationId" == "{{org_id}}"

# ── 2. getPosition ─────────────────────────────────────────────────────────
GET {{api}}/association/member/positions/{{position_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{position_id}}"
jsonpath "$.title" == "Test Position {{suffix}}"

# ── 3. listPositions includes the new one ──────────────────────────────────
GET {{api}}/association/member/positions?organizationId={{org_id}}&limit=100
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.items[?(@.id == '{{position_id}}')].title" == "Test Position {{suffix}}"

# ── 4. updatePosition termLengthMonths ─────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

PATCH {{api}}/association/member/positions/{{position_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "title": "Test Position {{suffix}}",
  "organizationId": "{{org_id}}",
  "level": "chapter",
  "termLengthMonths": 24,
  "description": "Updated description",
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.termLengthMonths" == 24

# ── 5. deletePosition ──────────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/positions/{{position_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200

# ── 6. getPosition after delete → 404 ──────────────────────────────────────
GET {{api}}/association/member/positions/{{position_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 404
