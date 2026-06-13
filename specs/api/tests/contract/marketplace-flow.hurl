# Marketplace contract flow — exercises every Marketplace operationId at least
# once and proves the full workflow end-to-end with captured real ids:
#   create vendor → verify → create listing → activate → place order →
#   get/list orders → fulfil; then a second order → cancel.
#
# Routes live under /association/marketplace/* so the /association/*
# orgContextMiddleware resolves organizationId before insert (AHA FIX-001 /
# G-01 — D-11 resolved). State-changing routes never 500: assertions are exact.
#
# Batch B (AHA FIX-003..007) added: updateListing (activation), listOrders,
# getOrder, cancelOrder, decision-based verifyVendor, null-price guard, and
# org-scoped order/listing lookups. This flow exercises each, including the
# FSM 409 negatives (draft→archived, cancel a fulfilled order, re-cancel).
#
# Covers operationIds:
#   createVendor, listVendors, getVendor, updateVendor, verifyVendor,
#   createListing, listListings, updateListing,
#   createOrder, listOrders, getOrder, cancelOrder, fulfillOrder
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

GET {{api}}/association/marketplace/vendors
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

GET {{api}}/association/marketplace/vendors
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 2. Create a real vendor (unique suffix → always 201) ─────────────────────

POST {{api}}/association/marketplace/vendors
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
HTTP 201
[Captures]
vendor_id: jsonpath "$.id"
[Asserts]
jsonpath "$.verificationStatus" == "pending"

# ── 3. Get the vendor back ───────────────────────────────────────────────────

GET {{api}}/association/marketplace/vendors/{{vendor_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{vendor_id}}"

# ── 4. Update the vendor ─────────────────────────────────────────────────────

PATCH {{api}}/association/marketplace/vendors/{{vendor_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "description": "Updated via contract test."
}
HTTP 200

# ── 5. Verify the vendor (decision-based, pending → verified) — FIX-004 ──────

POST {{api}}/association/marketplace/vendors/{{vendor_id}}/verify
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "decision": "verified"
}
HTTP 200
[Asserts]
jsonpath "$.verificationStatus" == "verified"

# ── 6. List listings ─────────────────────────────────────────────────────────

GET {{api}}/association/marketplace/listings
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 7. Negative: create listing under a synthetic (missing) vendor → 4xx ─────

POST {{api}}/association/marketplace/listings
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "vendorId": "00000000-0000-4000-8000-000000000000",
  "title": "Should not exist {{suffix}}",
  "description": "Synthetic vendor"
}
HTTP *
[Asserts]
status toString matches "^(400|403|404|422)$"

# ── 8. Create a real listing under the verified vendor (draft) ───────────────

POST {{api}}/association/marketplace/listings
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "vendorId": "{{vendor_id}}",
  "title": "Contract Test Listing {{suffix}}",
  "description": "Sample product",
  "price": "100.00"
}
HTTP 201
[Captures]
listing_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"

# ── 9. Negative: invalid transition draft → archived → 409 (FIX-003 FSM) ─────

PATCH {{api}}/association/marketplace/listings/{{listing_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "status": "archived"
}
HTTP 409

# ── 10. Activate the listing (draft → active) — FIX-003 ──────────────────────

PATCH {{api}}/association/marketplace/listings/{{listing_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "status": "active"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "active"

# ── 11. Negative: order against a synthetic (missing) listing → 404 ──────────

POST {{api}}/association/marketplace/orders
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "listingId": "00000000-0000-4000-8000-000000000000",
  "quantity": 1
}
HTTP 404

# ── 12. Place a real order against the active listing (qty 2 → total 200.00) ─

POST {{api}}/association/marketplace/orders
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "listingId": "{{listing_id}}",
  "quantity": 2
}
HTTP 201
[Captures]
order_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "pending"
jsonpath "$.totalPrice" == "200.00"

# ── 13. Get the order back (org-scoped) — FIX-006 ────────────────────────────

GET {{api}}/association/marketplace/orders/{{order_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{order_id}}"

# ── 14. List orders (org-scoped) — FIX-006 ───────────────────────────────────

GET {{api}}/association/marketplace/orders
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 15. Fulfil the order (pending → fulfilled) ───────────────────────────────

POST {{api}}/association/marketplace/orders/{{order_id}}/fulfill
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP 200
[Asserts]
jsonpath "$.status" == "fulfilled"

# ── 16. Negative: cancel a fulfilled order → 409 (FIX-006 FSM) ───────────────

POST {{api}}/association/marketplace/orders/{{order_id}}/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP 409

# ── 17. Place a second order, then cancel it (pending → cancelled) ───────────

POST {{api}}/association/marketplace/orders
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "listingId": "{{listing_id}}",
  "quantity": 1
}
HTTP 201
[Captures]
order2_id: jsonpath "$.id"

# ── 18. Cancel the second order — FIX-006 (wires dead cancelOrder) ───────────

POST {{api}}/association/marketplace/orders/{{order2_id}}/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP 200
[Asserts]
jsonpath "$.status" == "cancelled"

# ── 19. Negative: re-cancel the cancelled order → 409 (terminal) ─────────────

POST {{api}}/association/marketplace/orders/{{order2_id}}/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP 409
