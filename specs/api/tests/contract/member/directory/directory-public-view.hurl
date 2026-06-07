# member/directory — getPublicDirectoryProfile (unauth)
#
# Covers operationIds:
#   getPublicDirectoryProfile
# Real flow: admin sets up a public directory profile for seed member01,
# then an unauthenticated request fetches the public projection and
# verifies the privacy-filtered shape (PublicDirectoryProfile — no
# internal IDs, audit fields, or contactPhone leaked).

# ── 0. Resolve member01 personId ───────────────────────────────────────────
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
member_person_id: jsonpath "$.user.id"

# ── 1. Sign in as admin ────────────────────────────────────────────────────
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

# ── 2. createDirectoryProfile (public) for member01 ────────────────────────
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
  "personId": "{{member_person_id}}",
  "displayName": "Public Test {{suffix}}",
  "title": "DMD",
  "specialty": "Orthodontics",
  "location": "Quezon City",
  "bio": "Public-facing bio for contract test {{suffix}}",
  "website": "https://example.org/{{suffix}}",
  "contactPhone": "+63-2-1234-5678",
  "visibility": "public"
}
HTTP 201
[Captures]
public_profile_id: jsonpath "$.id"

# ── 3. UNAUTH: getPublicDirectoryProfile → 200, reduced shape ──────────────
GET {{api}}/association/member/directory/search/{{member_person_id}}/public
Origin: {{origin}}
HTTP 200
[Asserts]
jsonpath "$.personId" == "{{member_person_id}}"
jsonpath "$.displayName" == "Public Test {{suffix}}"
jsonpath "$.title" == "DMD"
jsonpath "$.specialty" == "Orthodontics"
jsonpath "$.location" == "Quezon City"
jsonpath "$.website" == "https://example.org/{{suffix}}"

# ── 4. UNAUTH: getPublicDirectoryProfile for unknown person → 404 ──────────
GET {{api}}/association/member/directory/search/00000000-0000-0000-0000-000000000000/public
Origin: {{origin}}
HTTP 404

# ── 5. Cleanup: delete the profile ────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/directory/profiles/{{public_profile_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 204
