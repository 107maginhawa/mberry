# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Email module: auth gate for non-admins, then full happy-path admin
# coverage on templates + queue. The runner-injected {{seed_officer_email}} +
# {{seed_officer_password}} let scenarios sign in as admin without juggling
# cookie headers.

# 1. Anonymous → 401.
GET {{api}}/email/templates
x-org-id: {{org_id}}
HTTP 401


# 2. Regular signed-up user → 403 (lacks admin role). Cookie jar holds
# the new user's session after sign-up.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "email-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Email Tester"
}
HTTP 200


GET {{api}}/email/templates
x-org-id: {{org_id}}
HTTP 403


# 2b. Non-admin DELETE of a suppression → 403 (FIX-007 RBAC).
# Still the regular user's session — admin role is required to unblock.
DELETE {{api}}/email/suppressions/00000000-0000-0000-0000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
HTTP 403


# 3. Sign in as the seeded admin so the cookie jar holds the admin's
# session for the rest of the scenario.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200


# 4. Admin lists templates - the impl auto-initializes system templates
# at startup (auth.email-verify, auth.password-reset, etc.).
GET {{api}}/email/templates
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 1


# 5. Admin creates a custom template.
POST {{api}}/email/templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "name": "Contract suite custom template {{suffix}}",
  "description": "Created by the contract suite",
  "subject": "Hello from contract-suite-{{suffix}}",
  "bodyHtml": "<p>Hello, this is a contract test.</p>",
  "bodyText": "Hello, this is a contract test.",
  "status": "active"
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"
[Asserts]
jsonpath "$.name" matches "{{suffix}}"


# 6. Admin reads the template back.
GET {{api}}/email/templates/{{template_id}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{template_id}}"


# 7. Admin updates description.
PATCH {{api}}/email/templates/{{template_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "description": "Updated by contract suite"
}
HTTP 200
[Asserts]
jsonpath "$.description" == "Updated by contract suite"


# 8. Admin lists email queue (just verify shape).
GET {{api}}/email/queue
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" exists


# 9. Filter queue by status.
GET {{api}}/email/queue?status=sent
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# 10. Admin deletes a non-existent suppression → 404 (FIX-007 / WF-125).
# Proves the DELETE endpoint exists, the admin passes RBAC (404 not 403),
# and the not-found path is handled. A 204 happy-path delete is covered by
# the deleteEmailSuppression unit test (no suppression is seeded to delete).
DELETE {{api}}/email/suppressions/00000000-0000-0000-0000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
HTTP 404
