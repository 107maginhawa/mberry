# member/credentials — RBAC contracts (401 + 403)
#
# Locks the authorization edges of the credentials surface:
#   - Unauthenticated callers get 401 on admin mutating endpoints.
#   - A signed-in non-admin user gets 403 on createCredentialTemplate,
#     issueDigitalCredential, createProfessionalLicense.
# Public-verify and lookup remain reachable without auth (different test).

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Unauthenticated createCredentialTemplate → 401 ──────────────────────
POST {{api}}/association/member/credential-templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "RBAC Probe {{suffix}}",
  "type": "memberCard",
  "status": "active",
  "validityPeriod": 365
}
HTTP 401

# ── 1. Unauthenticated issueDigitalCredential → 401 ────────────────────────
POST {{api}}/association/member/credentials/issue
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "00000000-0000-0000-0000-000000000000",
  "templateId": "00000000-0000-0000-0000-000000000000",
  "credentialNumber": "RBAC-{{suffix}}"
}
HTTP 401

# ── 2. Unauthenticated createProfessionalLicense → 401 ─────────────────────
POST {{api}}/association/member/licenses
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "00000000-0000-0000-0000-000000000000",
  "licenseType": "DDS",
  "licenseNumber": "L-{{suffix}}",
  "issuingAuthority": "PRC",
  "jurisdiction": "PH",
  "issuedDate": "2025-01-01",
  "expirationDate": "2027-01-01",
  "status": "active"
}
HTTP 401

# ── 3. Sign up a fresh non-admin user ──────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "rbac-cred-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "RBAC Cred Probe {{suffix}}"
}
HTTP 200
[Captures]
plain_user_cookie: cookie "better-auth.session_token"

# ── 4. Non-admin createCredentialTemplate → 403 ────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/credential-templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{plain_user_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Plain Template {{suffix}}",
  "type": "memberCard",
  "status": "active",
  "validityPeriod": 365
}
HTTP 403

# ── 5. Non-admin issueDigitalCredential → 403 ──────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/credentials/issue
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{plain_user_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "00000000-0000-0000-0000-000000000000",
  "templateId": "00000000-0000-0000-0000-000000000000",
  "credentialNumber": "RBAC-{{suffix}}"
}
HTTP 403

# ── 6. Non-admin createProfessionalLicense → 403 ───────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/licenses
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{plain_user_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "00000000-0000-0000-0000-000000000000",
  "licenseType": "DDS",
  "licenseNumber": "L-{{suffix}}",
  "issuingAuthority": "PRC",
  "jurisdiction": "PH",
  "issuedDate": "2025-01-01",
  "expirationDate": "2027-01-01",
  "status": "active"
}
HTTP 403
