# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# [R3-5] Association dues aging-buckets — get + recalculate.
# Was a sign-up-only stub that asserted nothing. Now an association:admin reads
# the org's receivables aging snapshot and recalculates it, asserting the real
# aging tiers come back (current / 30 / 60 / 90 / 90+ + total outstanding).

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


# 1. Read the current aging snapshot.
GET {{api}}/association/member/aging-buckets/{{org_id}}
x-org-id: {{org_id}}
HTTP 200


# 2. Recalculate — the response carries the org id + every aging tier.
POST {{api}}/association/member/aging-buckets/{{org_id}}/recalculate
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP 200
[Asserts]
jsonpath "$.organizationId" == "{{org_id}}"
jsonpath "$.current" exists
jsonpath "$.thirtyDay" exists
jsonpath "$.sixtyDay" exists
jsonpath "$.ninetyDay" exists
jsonpath "$.overNinety" exists
jsonpath "$.totalOutstanding" exists
