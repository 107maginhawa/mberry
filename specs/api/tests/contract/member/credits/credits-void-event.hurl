# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/credits — officer bulk-voids manual credits by activityName
#
# Covers operationId: voidCreditEntry
# Real flow: officer signs in, awards a manual credit to themselves
# (person_id FK satisfied; idempotencyKey is a fresh UUID since the
# underlying source_id column is uuid-typed), then bulk-voids by
# activityName via the now-generated /credits/void-event route.
#
# Post-Cr.7 note: the hand-wired duplicate at app.ts:580 was killed
# during this cutover. The single live registration is the generated
# route (TypeSpec x-security-required-roles enforces role at
# middleware; handler enforces position President/Secretary/Treasurer).

# ── 0. Sign in as officer ──────────────────────────────────────────
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
officer_person_id: jsonpath "$.user.id"


# ── 1. Award manual credit to set up the active state ──────────────
POST {{api}}/association/member/credits/manual
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{officer_person_id}}",
  "activityName": "Hurl Void Test Activity {{suffix}}",
  "activityDate": "2026-01-15T00:00:00Z",
  "creditAmount": 3,
  "idempotencyKey": "{{newUuid}}",
  "category": "General"
}
HTTP 201


# ── 2. voidCreditEntry → 200, {data:{voidedCount}} envelope, count >= 1 ──
POST {{api}}/association/member/credits/void-event
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "activityName": "Hurl Void Test Activity {{suffix}}",
  "personIds": ["{{officer_person_id}}"],
  "reason": "Hurl contract void test — activity superseded"
}
HTTP 200
[Asserts]
jsonpath "$.data.voidedCount" >= 1


# ── 3. Re-void same activity → 404 (no active credits left) ─────────
POST {{api}}/association/member/credits/void-event
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "activityName": "Hurl Void Test Activity {{suffix}}",
  "personIds": ["{{officer_person_id}}"],
  "reason": "Hurl contract verify idempotency"
}
HTTP 404
