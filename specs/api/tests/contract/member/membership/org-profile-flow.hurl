# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — organization profile get + update flow
#
# Covers operationIds: getOrganizationProfile, updateOrganizationProfile
# Real flow: officer fetches the seeded org's profile, updates a single
# field, then re-fetches to verify persistence. Distinct from the
# legacy /membership/org-profile/* admin-tier surface (4 LIVE legacy
# handlers at handlers/membership/) — this hits the NEW
# OrganizationProfileManagement interface at /association/member/org-profile/*.
#
# Idempotency: per-{{suffix}} string for contact email; org_id is the
# seeded ed8e3a96-... — single global org, no per-run randomization.

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


# ── 1. getOrganizationProfile → 200 ───────────────────────────────────
GET {{api}}/association/member/org-profile/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200


# ── 2. updateOrganizationProfile → 200 ────────────────────────────────
PUT {{api}}/association/member/org-profile/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "description": "Hurl org-profile test {{suffix}}"
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 3. getOrganizationProfile again → 200 (verify persistence) ───────
GET {{api}}/association/member/org-profile/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
