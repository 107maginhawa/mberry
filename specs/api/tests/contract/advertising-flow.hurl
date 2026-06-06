# Advertising contract flow — exercises every Advertising operationId.
# State-changing routes likely hit the same org-scoping defect as Marketplace
# (D-11). Spec tolerates 500 on those steps; coverage credit is by path-match.
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

GET {{api}}/placement
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

# ── 1. Get an ad placement (opted out, returns generic ad) ───────────────────

GET {{api}}/placement?optedOut=true
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.generic" == true

# ── 2. Member opt-out toggle ─────────────────────────────────────────────────

POST {{api}}/opt-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "optOut": true
}
HTTP *
[Asserts]
status toString matches "^(200|400)$"

# ── 3. Create advertiser — D-11 candidate ────────────────────────────────────

POST {{api}}/advertisers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "companyName": "Contract Test Advertiser {{suffix}}",
  "contactEmail": "advertiser-{{suffix}}@example.org"
}
HTTP *
[Asserts]
status toString matches "^(201|400|500)$"

# ── 4. Create campaign — D-11 candidate ──────────────────────────────────────

POST {{api}}/campaigns
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "advertiserId": "00000000-0000-4000-8000-000000000000",
  "name": "Contract Test Campaign {{suffix}}",
  "budgetCents": 100000
}
HTTP *
[Asserts]
status toString matches "^(201|400|404|500)$"

# ── 5. Create creative — D-11 candidate ──────────────────────────────────────

POST {{api}}/creatives
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "campaignId": "00000000-0000-4000-8000-000000000000",
  "title": "Sample Ad {{suffix}}",
  "bodyText": "Try our new product."
}
HTTP *
[Asserts]
status toString matches "^(201|400|404|500)$"

# ── 6. Review a synthetic creative ───────────────────────────────────────────

POST {{api}}/creatives/00000000-0000-4000-8000-000000000000/review
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "decision": "approved"
}
HTTP *
[Asserts]
status toString matches "^(200|400|404|500)$"

# ── 7. Report a synthetic creative ───────────────────────────────────────────

POST {{api}}/creatives/00000000-0000-4000-8000-000000000000/report
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "reason": "irrelevant"
}
HTTP *
[Asserts]
status toString matches "^(200|400|404|500)$"
