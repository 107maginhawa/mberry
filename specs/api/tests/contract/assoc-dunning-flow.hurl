# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# [R3-5] Association dues dunning — list events, list templates, run dunning.
# Was a sign-up-only stub that asserted nothing. Now an association:admin lists
# the dunning event log + templates and triggers a dunning run, asserting the
# run reports how many overdue obligations it evaluated.

# 0. Sign in as the seed officer (association:admin for {{org_id}}).
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200


# 1. The dunning event log is a paginated list.
GET {{api}}/association/member/dunning/events
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" exists


# 2. Dunning escalation templates.
GET {{api}}/association/member/dunning/templates
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" exists


# 3. Run dunning — the response reports the evaluated/sent counts.
POST {{api}}/association/member/dunning/run
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "organizationId": "{{org_id}}"
}
HTTP 200
[Asserts]
jsonpath "$.evaluated" exists
jsonpath "$.sent" exists
