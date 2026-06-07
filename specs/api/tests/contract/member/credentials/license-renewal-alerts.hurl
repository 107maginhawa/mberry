# member/credentials — license renewal alerts list + acknowledge
#
# Covers operationIds: listLicenseRenewalAlerts, acknowledgeLicenseRenewalAlert
# Real flow: admin lists renewal alerts (paginated, empty list is valid),
# attempts to acknowledge a fabricated id and expects 404. Sentinel
# acknowledge happy-path is not exercised here because seeded data
# may not include open alerts at test time; the list contract is the
# parity gate.

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

# ── 1. listLicenseRenewalAlerts — empty or seeded ──────────────────────────
GET {{api}}/association/member/license-renewal-alerts?limit=10
Origin: {{origin}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.pagination.limit" == 10
jsonpath "$.pagination.offset" == 0

# ── 2. acknowledgeLicenseRenewalAlert on bogus id → 404 ────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/association/member/license-renewal-alerts/00000000-0000-0000-0000-000000000000/acknowledge
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 404
