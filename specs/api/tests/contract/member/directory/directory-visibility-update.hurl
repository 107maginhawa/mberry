# member/directory — visibility transition + partial PATCH
#
# Covers operationIds:
#   createDirectoryProfile, updateDirectoryProfile, deleteDirectoryProfile,
#   getPublicDirectoryProfile (visibility-aware projection)
# Real flow: sign up a fresh person (no pre-existing directory profile),
# admin creates a `public` profile for them, the unauth public
# projection returns it, a partial PATCH flips visibility to `hidden`
# (PATCH-only body — full body trips the 500 toISOString gotcha), and
# the public projection is then filtered out (404).

# ── 0. Sign up a fresh person (no prior directory profile) ─────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "vis-dir-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Visibility Probe {{suffix}}"
}
HTTP 200
[Captures]
fresh_person_id: jsonpath "$.user.id"

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

# ── 2. createDirectoryProfile (public) for fresh person ────────────────────
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
  "personId": "{{fresh_person_id}}",
  "displayName": "Visibility Probe {{suffix}}",
  "specialty": "Periodontics",
  "location": "Cebu City",
  "visibility": "public"
}
HTTP 201
[Captures]
visibility_profile_id: jsonpath "$.id"
[Asserts]
jsonpath "$.visibility" == "public"

# ── 3. UNAUTH public projection visible while public ───────────────────────
GET {{api}}/association/member/directory/search/{{fresh_person_id}}/public
Origin: {{origin}}
HTTP 200
[Asserts]
jsonpath "$.personId" == "{{fresh_person_id}}"
jsonpath "$.displayName" == "Visibility Probe {{suffix}}"
jsonpath "$.specialty" == "Periodontics"
jsonpath "$.location" == "Cebu City"

# ── 4. Partial PATCH → hide profile ────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

PATCH {{api}}/association/member/directory/profiles/{{visibility_profile_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "visibility": "hidden"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{visibility_profile_id}}"
jsonpath "$.visibility" == "hidden"
jsonpath "$.displayName" == "Visibility Probe {{suffix}}"
jsonpath "$.specialty" == "Periodontics"

# ── 5. UNAUTH public projection filtered out → 404 ─────────────────────────
GET {{api}}/association/member/directory/search/{{fresh_person_id}}/public
Origin: {{origin}}
HTTP 404

# ── 6. Authenticated officer can still getDirectoryProfile (admin view) ────
GET {{api}}/association/member/directory/profiles/{{visibility_profile_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{visibility_profile_id}}"
jsonpath "$.visibility" == "hidden"

# ── 7. Cleanup ─────────────────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/directory/profiles/{{visibility_profile_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 204
