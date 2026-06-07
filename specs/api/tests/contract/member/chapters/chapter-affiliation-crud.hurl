# member/chapters — chapter affiliation full-roundtrip CRUD
#
# Covers operationIds:
#   createChapterAffiliation, getChapterAffiliation,
#   listChapterAffiliations, updateChapterAffiliation,
#   setPrimaryChapterAffiliation, deleteChapterAffiliation
# Role: association:admin (mutations); list/get also accepts chapter:officer.
# Real flow: sign in as seeded officer (admin role), pick a chapter id from
# listOrgChapters, sign up a fresh person, create affiliation, prove
# returned id resolves via GET + appears in LIST, mutate via PATCH +
# set-primary, then DELETE and prove gone.

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Sign in as seeded officer (has association:admin) ───────────────────
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

# ── 1. Capture a chapter id from listOrgChapters ───────────────────────────
GET {{api}}/association/member/chapters
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Captures]
chapter_id: jsonpath "$.data[0].chapterId"

# ── 2. Sign up a fresh person to attach the affiliation to ─────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "chaff-target-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Affiliation Target {{suffix}}"
}
HTTP 200
[Captures]
target_person_id: jsonpath "$.user.id"

# ── 3. Re-sign in as officer (sign-up rotated cookie jar to fresh user) ────
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

# ── 4. Create chapter affiliation (real DB row) ────────────────────────────
POST {{api}}/association/member/chapter-affiliations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{target_person_id}}",
  "chapterId": "{{chapter_id}}",
  "isPrimary": false,
  "affiliatedAt": "2026-01-01T00:00:00.000Z"
}
HTTP 201
[Captures]
affiliation_id: jsonpath "$.id"
[Asserts]
jsonpath "$.personId" == "{{target_person_id}}"
jsonpath "$.chapterId" == "{{chapter_id}}"
jsonpath "$.status" == "active"
jsonpath "$.isPrimary" == false

# ── 5. GET resolves the returned id ────────────────────────────────────────
GET {{api}}/association/member/chapter-affiliations/{{affiliation_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{affiliation_id}}"
jsonpath "$.personId" == "{{target_person_id}}"

# ── 6. LIST filtered by personId includes the affiliation ──────────────────
GET {{api}}/association/member/chapter-affiliations?personId={{target_person_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.data[?(@.id=='{{affiliation_id}}')]" exists

# ── 7. PATCH update (toggle isPrimary on) ──────────────────────────────────
PATCH {{api}}/association/member/chapter-affiliations/{{affiliation_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "isPrimary": true
}
HTTP 200
[Asserts]
jsonpath "$.isPrimary" == true

# ── 8. set-primary endpoint (idempotent — re-pin same affiliation) ─────────
POST {{api}}/association/member/chapter-affiliations/{{affiliation_id}}/set-primary
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{affiliation_id}}"
jsonpath "$.isPrimary" == true

# ── 9. DELETE removes the row ──────────────────────────────────────────────
DELETE {{api}}/association/member/chapter-affiliations/{{affiliation_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 204

# ── 10. Subsequent GET → 404 ───────────────────────────────────────────────
GET {{api}}/association/member/chapter-affiliations/{{affiliation_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 404
