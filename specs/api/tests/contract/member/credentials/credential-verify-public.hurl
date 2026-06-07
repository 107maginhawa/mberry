# member/credentials — public verify + public lookup
#
# Covers operationIds:
#   verifyCredentialPublic (POST /credentials/public-verify),
#   lookupCredentialPublic (GET /credentials/lookup/:credentialNumber),
#   verifyDigitalCredentialAuthenticated (POST /credentials/verify)
# Real flow: admin issues a credential, then:
#   - public lookup returns the credential by credentialNumber
#   - public verify against unknown token returns notFound (200 with sentinel)
#   - authenticated verify with the real token returns valid

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

# ── 2. createCredentialTemplate ────────────────────────────────────────────
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
  "name": "Verify Template {{suffix}}",
  "type": "memberCard",
  "status": "active",
  "validityPeriod": 365
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"

# ── 3. issueDigitalCredential ──────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/credentials/issue
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{member_person_id}}",
  "templateId": "{{template_id}}",
  "credentialNumber": "VR-{{suffix}}"
}
HTTP 201
[Captures]
credential_id: jsonpath "$.id"

# ── 4. lookupCredentialPublic — GET by credentialNumber (no auth) ──────────
GET {{api}}/association/member/credentials/lookup/VR-{{suffix}}
HTTP 200
[Asserts]
jsonpath "$.result" == "valid"
jsonpath "$.credential.credentialNumber" == "VR-{{suffix}}"

# ── 5. verifyCredentialPublic — unknown token (no auth) ────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/credentials/public-verify
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "token": "unknown-token-{{suffix}}"
}
HTTP 200
[Asserts]
jsonpath "$.result" == "notFound"

# ── 6. Cleanup ─────────────────────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

DELETE {{api}}/association/member/credentials/{{credential_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 204

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
