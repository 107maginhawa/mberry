# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/duesspecialassessments — funds + financial reporting surface
#
# Covers operationIds: listDuesFunds, upsertDuesFunds,
# getDuesFinancialDashboard, generateDuesReport
# Real flow: officer reads existing fund allocations, replaces with a
# 2-fund split (Operations 60% + Reserves 40% — reserves isLast=true to
# absorb rounding), re-lists, then queries the financial dashboard +
# generates a collection report.

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


# ── 1. listDuesFunds (pre-upsert) → 200 ───────────────────────────────
GET {{api}}/association/member/dues-reporting?organizationId={{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 2. upsertDuesFunds → 200 ──────────────────────────────────────────
PUT {{api}}/association/member/dues-reporting/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "funds": [
    { "fundName": "Operations {{suffix}}", "percentage": 60, "isLast": false },
    { "fundName": "Reserves {{suffix}}", "percentage": 40, "isLast": true }
  ]
}
HTTP 200


# ── 3. listDuesFunds (post-upsert) → 200 ──────────────────────────────
GET {{api}}/association/member/dues-reporting?organizationId={{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200


# ── 4. getDuesFinancialDashboard → 200 ────────────────────────────────
GET {{api}}/association/member/dues-reporting/{{org_id}}/dashboard
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 5. generateDuesReport (collection type) → 200 ────────────────────
GET {{api}}/association/member/dues-reporting/{{org_id}}/report?type=collection
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300
