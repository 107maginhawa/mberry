# MODULE_SPEC: marketplace

> Written from actual source inspection. See template at `docs/quality/MODULE_SPEC_TEMPLATE.md`.

## 1. Purpose
Vendor marketplace for healthcare associations. Allows verified vendors (EMR systems, medical suppliers, insurers, telehealth providers, etc.) to register and list their offerings for member organisations. Members browse listings and place orders; vendors fulfill them. Platform admins verify vendor legitimacy before listings go live.

## 2. Bounded Context
**In scope**: Vendor registration + verification, listing CRUD (draft → active → archived), order lifecycle (pending → confirmed → fulfilled / cancelled / refunded).

**Out of scope**: Payment processing for marketplace orders (TBD — currently no Stripe integration in this module; orders record price but do not process payment). Advertising/sponsored placement lives in the adjacent `advertising` module.

**Adjacent modules**: `advertising` (sponsored placement), `association:member` (org membership that gates vendor creation per org), `platformadmin` (org identity referenced in vendor FK).

## 3. Handler Inventory
| Handler file | Verb + Path | Auth required | Audit action | Notes |
|---|---|---|---|---|
| `createVendor.ts` | `POST /association/marketplace/vendors` | bearerAuth (any org member) | TBD | Creates vendor with `pending` verification status; validates companyName, contactEmail, category, description |
| `getVendor.ts` | `GET /association/marketplace/vendors/:vendorId` | bearerAuth | TBD | Single vendor fetch |
| `listVendors.ts` | `GET /association/marketplace/vendors` | bearerAuth | TBD | List vendors (org-scoped) |
| `updateVendor.ts` | `PATCH /association/marketplace/vendors/:vendorId` | bearerAuth | TBD | Update vendor profile |
| `verifyVendor.ts` | `POST /association/marketplace/vendors/:vendorId/verify` | bearerAuth (admin/officer) | TBD | Transitions vendor status (pending → verified / rejected / suspended) |
| `createListing.ts` | `POST /association/marketplace/listings` | bearerAuth (vendor) | TBD | Creates listing in `draft` status |
| `listListings.ts` | `GET /association/marketplace/listings` | bearerAuth | TBD | Browse active listings |
| `createOrder.ts` | `POST /association/marketplace/orders` | bearerAuth (member) | TBD | Places order; validates listing is active, computes total = unitPrice × quantity |
| `fulfillOrder.ts` | `POST /association/marketplace/orders/:orderId/fulfill` | bearerAuth (vendor) | TBD | Marks order fulfilled; enforces valid state transition via `assertValidTransition` |

## 4. TypeSpec source
`specs/api/src/modules/marketplace.tsp`

## 5. Database schema
`services/api-ts/src/handlers/marketplace/repos/marketplace.schema.ts`

Tables:
- `vendor` — `vendor_status` enum (pending/verified/suspended/rejected), `vendor_category` enum (emr/supplies/insurance/telehealth/other), FK to `organization_id`
- `listing` — `listing_status` enum (draft/active/archived), FK to vendor
- `order` — `order_status` enum (pending/confirmed/fulfilled/cancelled/refunded), FK to listing

Additional repo files: `vendor.repo.ts`, `listing.repo.ts`, `order.repo.ts`

## 6. Cross-module dependencies
- **Emits domain events**: none confirmed (not wired into `domain-event-consumers.ts`).
- **Consumes events from**: none.
- **Calls handlers from**: none directly. Uses `organizations` table from `platformadmin` schema (FK reference for `organization_id`).

## 7. Test coverage status
- Unit tests: 3 test files — `vendor-crud.test.ts` (15 assertions), `listing-order.test.ts` (21 assertions), `verifyVendor.test.ts` (8 assertions). Covers createVendor, listVendors, updateVendor, verifyVendor, createListing, createOrder. **~7/9 handlers** have some coverage.
- Contract scenarios: **0** Hurl files (no `marketplace*` found in `specs/api/tests/contract/`). **Gap — no contract coverage.**
- E2E: `apps/memberry/tests/e2e/stubs/marketplace-referral.spec.ts` — 1 stub file (likely a placeholder, not a full flow test).

## 8. Hand-wired routes (if any)
No marketplace routes appear in `app.ts` hand-wiring. All routes registered via TypeSpec-generated `routes.ts`.

## 9. Known gotchas
- **No payment processing**: `createOrder` computes `totalPrice` but does not initiate any payment. Orders go `pending → confirmed → fulfilled` purely by status transitions. Payment integration is not implemented — the spec and schema do not include payment fields on orders.
- **State machine enforcement**: `fulfillOrder` uses `assertValidTransition(MARKETPLACE_ORDER_VALID_TRANSITIONS, ...)` — check `utils/status-transitions.ts` for the full allowed-transition graph before adding new order states.
- **Vendor category enum**: Hardcoded to `['emr', 'supplies', 'insurance', 'telehealth', 'other']`. Adding a new category requires a Drizzle migration to extend the `vendor_category` pg enum.
- **Contract gap**: Zero Hurl contract tests — highest-risk gap in this module. Any schema change has no contract safety net.

## 10. AI extension checklist

To add a new endpoint to this module:
1. `specs/api/src/modules/marketplace.tsp` — declare operation + `@extension`s
2. `services/api-ts/src/handlers/marketplace/<verbResource>.ts` — handler impl
3. `services/api-ts/src/handlers/marketplace/<verbResource>.test.ts` — unit test
4. `specs/api/tests/contract/marketplace-<verb>-flow.hurl` — contract scenario (module has none; start one)
5. Run: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`
6. Frontend hook auto-generated; no manual SDK edits

Forbidden:
- Editing `services/api-ts/src/generated/**`
- Adding to `app.ts` unless reason fits `HAND_WIRED_ROUTES.yaml` allowed-reason set
- Verb prefixes `new*`/`make*`/`do*`/`process*`
- Hardcoding `vendor_category` values in handler logic — use enum from schema
