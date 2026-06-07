# member/credentials — credential template CRUD
#
# Covers operationIds:
#   createCredentialTemplate, getCredentialTemplate, listCredentialTemplates,
#   updateCredentialTemplate, deleteCredentialTemplate
# Real flow: admin creates a memberCard template, reads it back, lists,
# updates the name, deletes, verifies 404.

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

# ── 1. createCredentialTemplate ────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/credential-templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Template {{suffix}}",
  "type": "memberCard",
  "status": "active",
  "validityPeriod": 365
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" == "Template {{suffix}}"
jsonpath "$.type" == "memberCard"

# ── 2. getCredentialTemplate ───────────────────────────────────────────────
GET {{api}}/association/member/credential-templates/{{template_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{template_id}}"
jsonpath "$.name" == "Template {{suffix}}"

# ── 3. listCredentialTemplates ─────────────────────────────────────────────
GET {{api}}/association/member/credential-templates?organizationId={{org_id}}&limit=100
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data[?(@.id == '{{template_id}}')].name" == "Template {{suffix}}"

# ── 4. updateCredentialTemplate ────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

PATCH {{api}}/association/member/credential-templates/{{template_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Template {{suffix}} (rev2)"
}
HTTP 200
[Asserts]
jsonpath "$.name" == "Template {{suffix}} (rev2)"

# ── 5. deleteCredentialTemplate ────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/credential-templates/{{template_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 204

# ── 6. getCredentialTemplate → 404 ─────────────────────────────────────────
GET {{api}}/association/member/credential-templates/{{template_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 404
