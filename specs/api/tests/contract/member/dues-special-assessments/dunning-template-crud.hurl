# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/duesspecialassessments — dunning template CRUD
#
# Covers operationIds: createDunningTemplate, listDunningTemplates,
# getDunningTemplate, updateDunningTemplate, deleteDunningTemplate
# Real flow: officer creates a fresh template per {{suffix}}, lists
# templates (verifies appearance), fetches the new one by id, updates
# its body + stage status, then deletes.

# ── 0. Officer signs in ───────────────────────────────────────────────
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


# ── 1. createDunningTemplate → 201 ────────────────────────────────────
POST {{api}}/association/member/dunning/templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Hurl Dunning {{suffix}}",
  "stage": 1,
  "daysAfterDue": 7,
  "channel": "email",
  "subject": "Friendly reminder {{suffix}}",
  "body": "Your dues payment is overdue. Please remit at your convenience.",
  "status": "active"
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"


# ── 2. listDunningTemplates → 200 ─────────────────────────────────────
GET {{api}}/association/member/dunning/templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200


# ── 3. getDunningTemplate → 200 ───────────────────────────────────────
GET {{api}}/association/member/dunning/templates/{{template_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{template_id}}"


# ── 4. updateDunningTemplate → 200 ────────────────────────────────────
PATCH {{api}}/association/member/dunning/templates/{{template_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "body": "Updated reminder body for {{suffix}}.",
  "status": "inactive"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 5. deleteDunningTemplate → 200/204 ────────────────────────────────
DELETE {{api}}/association/member/dunning/templates/{{template_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300
