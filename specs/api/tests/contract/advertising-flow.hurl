# Advertising contract flow — exercises every Advertising operationId.
# Routes now live under /association/advertising/* so the /association/*
# orgContextMiddleware resolves organizationId before insert (AHA FIX-001 /
# G-01 — D-11 resolved). State-changing routes no longer 500: assertions are
# tightened to exact statuses (no 500 tolerance).
#
# AHA Batch C (FIX-008/009/010) extends this flow with real safety-rail
# journeys: server-side opt-out enforcement, the client-flag-ignored bypass
# check, campaign-state serve gating, and a persisted 3-report pipeline.
#
# Covers operationIds:
#   createAdvertiser, createCampaign, createCreative, reviewCreative,
#   reportAd, setMemberOptOut, getAdForPlacement
#
# Requires: seeded org + officer (test@memberry.ph) from db:seed-modules.
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# CSRF preamble
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── Auth: sign in as officer ──────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"

# ── 0. Unauthenticated → 401 ─────────────────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/advertising/placement
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

# ── Re-authenticate ───────────────────────────────────────────────────────────

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"

# =============================================================================
# AHA FIX-008 (G-02) — opt-out is PERSISTED and enforced SERVER-SIDE.
# The client `optedOut` query flag is no longer trusted.
# =============================================================================

# ── 1. Member opts OUT (persisted) ───────────────────────────────────────────

POST {{api}}/association/advertising/opt-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "optedOut": true
}
HTTP 200
[Asserts]
jsonpath "$.optedOut" == true
jsonpath "$.effectiveImmediately" == true

# ── 2. Placement returns generic (server-side opt-out, NO client flag) ────────

GET {{api}}/association/advertising/placement
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.generic" == true
jsonpath "$.reason" == "member_opted_out"
jsonpath "$.ad" == null

# ── 3. Client cannot bypass the persisted opt-out via a query flag ───────────
# Member is opted OUT in the DB; passing optedOut=false must NOT re-enable ads.

GET {{api}}/association/advertising/placement?optedOut=false
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.reason" == "member_opted_out"

# ── 4. Member opts back IN (opt-out row deleted) ─────────────────────────────

POST {{api}}/association/advertising/opt-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "optedOut": false
}
HTTP 200
[Asserts]
jsonpath "$.optedOut" == false

# ── 5. Placement no longer reports opt-out (preference removed) ──────────────

GET {{api}}/association/advertising/placement
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.generic" == false

# ── 6. Client cannot force opt-out via a query flag either (flag ignored) ────
# Member is opted IN in the DB; passing optedOut=true must NOT suppress ads.

GET {{api}}/association/advertising/placement?optedOut=true
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.generic" == false

# =============================================================================
# AHA FIX-009 (G-03) / FIX-010 (G-09) — ad reports are PERSISTED and counted in
# a rolling 7-day window; draft campaigns do not serve. Real advertiser →
# campaign → creative chain. Batch D fixed the reviewCreative `{ approved }`
# contract mismatch, so the creative is now APPROVED end-to-end (step 9b),
# which arms the M16-R5 report→auto-pause path: the 3rd report (threshold) flips
# the approved creative back to `pending` (autoPaused == true). This is the live
# proof that was deferred from Batch C.
# =============================================================================

# ── 7. Create advertiser → capture id ────────────────────────────────────────

POST {{api}}/association/advertising/advertisers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "companyName": "Contract Test Advertiser {{suffix}}",
  "contactEmail": "advertiser-{{suffix}}@example.org"
}
HTTP 201
[Captures]
advertiser_id: jsonpath "$.id"

# ── 8. Create campaign (real advertiserId) → capture id ──────────────────────

POST {{api}}/association/advertising/campaigns
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "advertiserId": "{{advertiser_id}}",
  "name": "Contract Test Campaign {{suffix}}",
  "budgetCents": 100000
}
HTTP 201
[Captures]
campaign_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"

# ── 9. Create creative (real campaignId) → capture id ────────────────────────

POST {{api}}/association/advertising/creatives
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "campaignId": "{{campaign_id}}",
  "title": "Sample Ad {{suffix}}",
  "bodyText": "Try our new product."
}
HTTP 201
[Captures]
creative_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "pending"

# ── 9b. Approve the creative (reviewCreative — Batch D contract fix) ──────────
# The handler now reads the contract `{ approved: boolean }` field (was the
# legacy `{ decision }`), so a pending creative can be approved end-to-end.
# An approved creative is the precondition for the report→auto-pause path.

POST {{api}}/association/advertising/creatives/{{creative_id}}/review
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "approved": true
}
HTTP 200
[Asserts]
jsonpath "$.status" == "approved"

# ── 10. Placement still serves for an opted-in member ───────────────────────
# Our newly created creative's campaign is `draft`, so FIX-010 gating excludes
# it; a seeded active-campaign ad serves instead (generic == false). The
# draft/paused/expired serve-gating is proven deterministically by unit tests.

GET {{api}}/association/advertising/placement
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.generic" == false

# ── 11. Report the creative — 1st report persists (count == 1) ───────────────

POST {{api}}/association/advertising/creatives/{{creative_id}}/report
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "reason": "misleading"
}
HTTP 200
[Asserts]
jsonpath "$.reportCount" == 1
jsonpath "$.autoPaused" == false

# ── 12. Report again — 2nd report persists (count == 2) ──────────────────────

POST {{api}}/association/advertising/creatives/{{creative_id}}/report
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "reason": "inappropriate"
}
HTTP 200
[Asserts]
jsonpath "$.reportCount" == 2

# ── 13. Report again — 3rd report persists (count == 3, rolling window) ──────

POST {{api}}/association/advertising/creatives/{{creative_id}}/report
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "reason": "irrelevant"
}
HTTP 200
[Asserts]
jsonpath "$.reportCount" == 3
# 3rd report hits the threshold on an APPROVED creative → auto-paused to pending.
jsonpath "$.autoPaused" == true
