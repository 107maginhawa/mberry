# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Platform admin flow: organizations, associations, admins, feature flags.
# Uses runner-injected {{seed_officer_email}} and {{seed_officer_password}}.

# ── 0. Anonymous → 401 ──────────────────────────────────────

GET {{api}}/admin/me/role
HTTP 401


# ── 1. Sign in as admin ─────────────────────────────────────

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
admin_cookie: cookie "better-auth.session_token"


# ── 2. Verify admin role ────────────────────────────────────

GET {{api}}/admin/me/role
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200


# ── 3. Create organization ──────────────────────────────────

# Capture a seeded association id — orgs MUST belong to an association.
GET {{api}}/admin/associations
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200
[Captures]
association_id: jsonpath "$.data[0].id"


POST {{api}}/admin/organizations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
Content-Type: application/json
{
  "name": "Contract Org {{suffix}}",
  "slug": "contract-org-{{suffix}}",
  "associationId": "{{association_id}}",
  "orgType": "chapter"
}
HTTP *
[Captures]
org_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300


# ── 4. List organizations ───────────────────────────────────

GET {{api}}/admin/organizations
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 5. Get organization ─────────────────────────────────────

GET {{api}}/admin/organizations/{{org_id}}
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{org_id}}"


# ── 6. Update organization ──────────────────────────────────

PATCH {{api}}/admin/organizations/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
Content-Type: application/json
{
  "name": "Updated Contract Org {{suffix}}"
}
HTTP 200


# ── 7. Transition organization ──────────────────────────────

POST {{api}}/admin/organizations/{{org_id}}/transition
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
Content-Type: application/json
{
  "status": "active"
}
HTTP *
[Asserts]
status >= 200
status < 400


# ── 8. Create association ───────────────────────────────────

POST {{api}}/admin/associations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
Content-Type: application/json
{
  "name": "Contract Assoc {{suffix}}",
  "slug": "contract-assoc-{{suffix}}",
  "country": "PH",
  "currency": "PHP"
}
HTTP *
[Captures]
assoc_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300


# ── 9. List associations ────────────────────────────────────

GET {{api}}/admin/associations
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 10. Get association ─────────────────────────────────────

GET {{api}}/admin/associations/{{assoc_id}}
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200


# ── 11. Update association ──────────────────────────────────

PATCH {{api}}/admin/associations/{{assoc_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
Content-Type: application/json
{
  "name": "Updated Contract Assoc {{suffix}}"
}
HTTP 200


# ── 12. Create admin user ───────────────────────────────────

POST {{api}}/admin/admins
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
Content-Type: application/json
{
  "email": "admin-new-{{suffix}}@example.org",
  "name": "New Admin {{suffix}}"
}
HTTP *
[Captures]
new_admin_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300


# ── 13. List admins ─────────────────────────────────────────

GET {{api}}/admin/admins
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 14. Update admin ────────────────────────────────────────

PATCH {{api}}/admin/admins/{{new_admin_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
Content-Type: application/json
{
  "name": "Renamed Admin {{suffix}}"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 15. Delete admin ────────────────────────────────────────

DELETE {{api}}/admin/admins/{{new_admin_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 16. Create feature flag ─────────────────────────────────

POST {{api}}/admin/feature-flags
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
Content-Type: application/json
{
  "name": "contract-flag-{{suffix}}",
  "enabled": true
}
HTTP *
[Captures]
flag_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300


# ── 17. List feature flags ──────────────────────────────────

GET {{api}}/admin/feature-flags
Cookie: better-auth.session_token={{admin_cookie}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 18. Delete feature flag ─────────────────────────────────

DELETE {{api}}/admin/feature-flags/{{flag_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 19. Delete association (cleanup) ────────────────────────

DELETE {{api}}/admin/associations/{{assoc_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{admin_cookie}}
HTTP *
[Asserts]
status >= 200
status < 300
