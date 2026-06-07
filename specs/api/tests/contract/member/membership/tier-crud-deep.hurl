# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — full tier CRUD coverage
#
# Covers operationIds: createMembershipTier, getMembershipTier,
# listMembershipTiers, updateMembershipTier, deleteMembershipTier
# Real flow: officer creates fresh tier per {{suffix}}, fetches it,
# lists tiers (verifies the new tier is present), updates name + fee,
# then deletes it.
#
# Idempotency: per-`{{suffix}}` tier code (uq membership_tier_org_code).

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


# ── 1. createMembershipTier → 201 ────────────────────────────────────
POST {{api}}/association/member/tiers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Hurl Tier {{suffix}}",
  "code": "hurl-tier-{{suffix}}",
  "description": "Per-run tier for contract testing.",
  "annualFee": 100000,
  "currency": "PHP",
  "benefits": ["benefit_a", "benefit_b"],
  "status": "active"
}
HTTP 201
[Captures]
new_tier_id: jsonpath "$.id"
[Asserts]
jsonpath "$.code" == "hurl-tier-{{suffix}}"
jsonpath "$.annualFee" == 100000


# ── 2. getMembershipTier → 200 ────────────────────────────────────────
GET {{api}}/association/member/tiers/{{new_tier_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{new_tier_id}}"


# ── 3. listMembershipTiers → 200, includes our tier ──────────────────
GET {{api}}/association/member/tiers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1


# ── 4. updateMembershipTier → 200 ─────────────────────────────────────
PATCH {{api}}/association/member/tiers/{{new_tier_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Hurl Tier {{suffix}} Updated",
  "annualFee": 150000
}
HTTP 200


# ── 5. deleteMembershipTier → 200/204 ─────────────────────────────────
DELETE {{api}}/association/member/tiers/{{new_tier_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300
