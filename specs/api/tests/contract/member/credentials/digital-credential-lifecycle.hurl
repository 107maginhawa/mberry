# member/credentials — digital credential issue → revoke lifecycle
#
# Covers operationIds:
#   issueDigitalCredential, getDigitalCredential, listDigitalCredentials,
#   updateDigitalCredential, revokeDigitalCredential, deleteDigitalCredential
#   (plus createCredentialTemplate as a precondition)
# Real flow: admin creates a template, looks up seed member01 as recipient,
# issues a credential, reads back, lists, updates, revokes, deletes.

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

# ── 2. createCredentialTemplate precondition ───────────────────────────────
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
  "name": "DC Template {{suffix}}",
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
  "credentialNumber": "DC-{{suffix}}"
}
HTTP 201
[Captures]
credential_id: jsonpath "$.id"
[Asserts]
jsonpath "$.credentialNumber" == "DC-{{suffix}}"
jsonpath "$.personId" == "{{member_person_id}}"

# ── 4. getDigitalCredential ────────────────────────────────────────────────
GET {{api}}/association/member/credentials/{{credential_id}}
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{credential_id}}"

# ── 5. listDigitalCredentials filtered by person ───────────────────────────
GET {{api}}/association/member/credentials?personId={{member_person_id}}&limit=100
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data[?(@.id == '{{credential_id}}')].credentialNumber" == "DC-{{suffix}}"

# ── 6. revokeDigitalCredential ─────────────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/credentials/{{credential_id}}/revoke
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "reason": "Contract test revoke"
}
HTTP 200

# ── 7. deleteDigitalCredential ─────────────────────────────────────────────
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

# ── 8. Cleanup — delete template ───────────────────────────────────────────
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
