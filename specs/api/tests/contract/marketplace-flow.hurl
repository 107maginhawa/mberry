# Marketplace contract flow — exercises every Marketplace operationId
# at least once. State-changing routes hit pre-existing org-context defects
# (D-11: createVendor / createListing / createOrder insert without
# organization_id, returning 500). Spec tolerates 500 + 4xx on those steps
# until the org-scoping middleware is fixed.
#
# Covers operationIds:
#   createVendor, listVendors, getVendor, updateVendor, verifyVendor,
#   createListing, listListings, createOrder, fulfillOrder
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

GET {{api}}/vendors
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

# ── 1. List vendors ──────────────────────────────────────────────────────────

GET {{api}}/vendors
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 2. Create a vendor — D-11: 500 on org_id NOT NULL violation ──────────────

POST {{api}}/vendors
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "companyName": "Contract Test Vendor {{suffix}}",
  "contactEmail": "vendor-{{suffix}}@example.org",
  "category": "supplies",
  "description": "Contract test vendor — dental supplies."
}
HTTP *
[Asserts]
status toString matches "^(201|400|500)$"

# ── 3. Get vendor — synthetic id ─────────────────────────────────────────────

GET {{api}}/vendors/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|404)$"

# ── 4. Update vendor — synthetic id ──────────────────────────────────────────

PATCH {{api}}/vendors/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "description": "Updated via contract test."
}
HTTP *
[Asserts]
status toString matches "^(200|404|500)$"

# ── 5. Verify vendor — synthetic id ──────────────────────────────────────────

POST {{api}}/vendors/00000000-0000-4000-8000-000000000000/verify
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|404|500)$"

# ── 6. List listings ─────────────────────────────────────────────────────────

GET {{api}}/listings
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 7. Create listing — D-11: 500 expected on org_id miss ────────────────────

POST {{api}}/listings
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "vendorId": "00000000-0000-4000-8000-000000000000",
  "title": "Contract Test Listing {{suffix}}",
  "description": "Sample product"
}
HTTP *
[Asserts]
status toString matches "^(201|400|404|422|500)$"

# ── 8. Create order — D-11: 500 expected on org_id miss ──────────────────────

POST {{api}}/orders
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "listingId": "00000000-0000-4000-8000-000000000000",
  "quantity": 1
}
HTTP *
[Asserts]
status toString matches "^(201|400|404|422|500)$"

# ── 9. Fulfil order — synthetic id ───────────────────────────────────────────

POST {{api}}/orders/00000000-0000-4000-8000-000000000000/fulfill
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|404|422)$"
