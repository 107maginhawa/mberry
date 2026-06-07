# member/credentials — professional license CRUD
#
# Covers operationIds:
#   createProfessionalLicense, getProfessionalLicense, listProfessionalLicenses,
#   updateProfessionalLicense, deleteProfessionalLicense
# Real flow: admin creates a license for seed member01, reads, lists,
# updates status, deletes.

# ── 0. Resolve seed member01 personId ──────────────────────────────────────
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

# ── 2. createProfessionalLicense ───────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/licenses
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{member_person_id}}",
  "licenseType": "DDS",
  "licenseNumber": "PL-{{suffix}}",
  "issuingAuthority": "PRC",
  "jurisdiction": "PH",
  "issuedDate": "2025-01-01",
  "expirationDate": "2027-01-01",
  "status": "active"
}
HTTP 201
[Captures]
license_id: jsonpath "$.id"
[Asserts]
jsonpath "$.licenseNumber" == "PL-{{suffix}}"
jsonpath "$.personId" == "{{member_person_id}}"

# ── 3. getProfessionalLicense ──────────────────────────────────────────────
GET {{api}}/association/member/licenses/{{license_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{license_id}}"

# ── 4. listProfessionalLicenses filtered by person ─────────────────────────
GET {{api}}/association/member/licenses?personId={{member_person_id}}&limit=100
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data[?(@.id == '{{license_id}}')].licenseNumber" == "PL-{{suffix}}"

# ── 5. updateProfessionalLicense → status=suspended ────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

PATCH {{api}}/association/member/licenses/{{license_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "status": "suspended"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "suspended"

# ── 6. deleteProfessionalLicense ───────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/licenses/{{license_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 204
