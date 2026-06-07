# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/membership — membership category upsert + list
#
# Covers operationIds: upsertMembershipCategory, listMembershipCategories
# Real flow: officer signs in, lists existing categories (sanity),
# upserts a new category (first call creates), upserts AGAIN with the
# same key (second call updates), then re-lists.
#
# Note: per Wave 7 cleanup, the 4 deprecated Category CRUD ops
# (create/get/update/delete) were dead-code-deleted. UpsertCategory +
# listCategories are the canonical surface.
#
# Idempotency: per-{{suffix}} category name; upsert is idempotent by
# design.

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


# ── 1. List tiers (need applicableTier id) ────────────────────────────
GET {{api}}/association/member/tiers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Captures]
tier_id: jsonpath "$.data[0].id"


# ── 2. listMembershipCategories (pre-upsert sanity) → 200 ────────────
GET {{api}}/association/member/membership-categories?organizationId={{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200


# ── 3. upsertMembershipCategory (create) → 200 ────────────────────────
PUT {{api}}/association/member/membership-categories/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Hurl Category {{suffix}}",
  "description": "Initial creation via upsert.",
  "applicableTiers": ["{{tier_id}}"]
}
HTTP *
[Asserts]
status >= 200
status < 300
[Captures]
category_id: jsonpath "$.id"


# ── 4. upsertMembershipCategory (update — same key) → 200 ─────────────
PUT {{api}}/association/member/membership-categories/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "name": "Hurl Category {{suffix}} Updated",
  "description": "Idempotent update via upsert.",
  "applicableTiers": ["{{tier_id}}"]
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 5. listMembershipCategories (post-upsert) → 200 ──────────────────
GET {{api}}/association/member/membership-categories?organizationId={{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
