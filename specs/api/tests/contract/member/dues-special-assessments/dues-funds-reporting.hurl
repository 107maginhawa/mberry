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
#
# ── CROSS-SUITE ISOLATION (why this targets the seed org, not a throwaway) ──
# upsertDuesFunds is a mutation: it deactivates the org's existing funds and
# writes Operations/Reserves. That contaminates whatever org it runs against.
# We CANNOT redirect it to a throwaway org, because both upsertDuesFunds
# (x-require-position Treasurer/President) and the only API way to grant that
# position (createPosition / createOfficerTerm) are themselves President-gated
# *for the same org* — and the seeded officer is President only of
# pda-metro-manila ({{org_id}}). There is no API path to bootstrap officer
# authority on a fresh org, so the upsert can only succeed here.
#
# The contamination is instead healed at the consumer boundary:
# services/api-ts/src/seed/reset-mutated.ts restores pda-metro-manila's
# canonical dues funds (General 50 / Building 30 / Emergency 20, all active,
# every Operations*/Reserves* row removed) on every Playwright E2E boot
# (apps/memberry/tests/e2e/global-setup.ts). That is the same seed-reset
# mechanism already used for org/association/tier pollution from E2E PATCHes.
# Net effect: the dues-lifecycle / settings-states E2E funds specs always see
# the canonical 3-fund 100% allocation regardless of this contract run.

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
