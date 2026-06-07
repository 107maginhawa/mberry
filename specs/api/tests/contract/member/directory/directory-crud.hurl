# member/directory — profile CRUD lifecycle
#
# Covers operationIds:
#   createDirectoryProfile, getDirectoryProfile, listDirectoryProfiles,
#   updateDirectoryProfile, deleteDirectoryProfile
# Real flow: admin signs in, creates a directory profile for the seed
# officer, reads it, lists with pagination, partial-PATCH updates the
# title, then deletes.

# ── 0. Sign in as admin / officer ──────────────────────────────────────────
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
officer_person_id: jsonpath "$.user.id"

# ── 1. createDirectoryProfile → 201, direct envelope ───────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/directory/profiles
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{officer_person_id}}",
  "displayName": "R4 CRUD {{suffix}}",
  "specialty": "Endodontics",
  "location": "Manila",
  "bio": "Contract test profile",
  "visibility": "public"
}
HTTP 201
[Captures]
profile_id: jsonpath "$.id"
[Asserts]
jsonpath "$.displayName" == "R4 CRUD {{suffix}}"
jsonpath "$.specialty" == "Endodontics"
jsonpath "$.visibility" == "public"
jsonpath "$.personId" == "{{officer_person_id}}"
jsonpath "$.organizationId" == "{{org_id}}"

# ── 2. getDirectoryProfile → 200, direct envelope ──────────────────────────
GET {{api}}/association/member/directory/profiles/{{profile_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{profile_id}}"
jsonpath "$.displayName" == "R4 CRUD {{suffix}}"
jsonpath "$.location" == "Manila"

# ── 3. listDirectoryProfiles → 200, {data, pagination} envelope ───────────
GET {{api}}/association/member/directory/profiles?limit=100
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" >= 1
jsonpath "$.data[?(@.id == '{{profile_id}}')].displayName" == "R4 CRUD {{suffix}}"

# ── 4. updateDirectoryProfile → 200 (partial PATCH body only) ──────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

PATCH {{api}}/association/member/directory/profiles/{{profile_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "title": "Senior Endodontist",
  "visibility": "memberOnly"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{profile_id}}"
jsonpath "$.title" == "Senior Endodontist"
jsonpath "$.visibility" == "memberOnly"
jsonpath "$.displayName" == "R4 CRUD {{suffix}}"

# ── 5. deleteDirectoryProfile → 204 ────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/directory/profiles/{{profile_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 204

# ── 6. getDirectoryProfile after delete → 404 ──────────────────────────────
GET {{api}}/association/member/directory/profiles/{{profile_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 404
