### marketplace

## marketplace module — Wave-3 (cluster peripheral) TDD slice plan

Floor currently **`line: 5, function: 0`** (`services/api-ts/.coverage-thresholds.json:34`). Tier = peripheral, **target floor 40**. Effort S–M.
Method (locked, mirrors Wave-1/2 ledgers): characterize existing code → TDD new behavior; where a MISSING BR is a real bug, red-test then fix the RIGHT layer. DoD priority: (1) real-PG harness in CI → (2) MISSING BRs get real tests → (3) MISSING workflows get real-flow coverage → (4) inter-module contracts proven → (5) ratchet floor toward 40 only as real coverage lands → (6) fix registry/coverage-threshold drift.

### Source facts verified (against source + live catalog)

- **Repos** (`src/handlers/marketplace/repos/`): `vendor.repo.ts`, `listing.repo.ts`, `order.repo.ts` over tables `vendor`, `marketplace_listing`, `marketplace_order` (all `marketplace.schema.ts`). Each repo extends `DatabaseRepository`. FK chain (live): `marketplace_listing.vendor_id → vendor.id ON DELETE CASCADE`; `marketplace_order.vendor_id → vendor.id` (no cascade); `marketplace_order.listing_id → marketplace_listing.id` (no cascade). Verified via `\d` on live DB.
- **Live catalog (verified `psql \d`):**
  - `vendor`: `organization_id` **NOT NULL** (matches Drizzle `.notNull()` — **no drift**), `company_name`/`category`/`description`/`contact_email` NOT NULL, `verification_status` NOT NULL default `'pending'::vendor_status`. Indexes: `vendors_org_idx`, `vendors_status_idx`, `vendors_category_idx`. **No CHECK, no UNIQUE beyond pkey.**
  - `marketplace_listing`: `organization_id` NOT NULL (**no drift**), `vendor_id` NOT NULL, `title`/`description` NOT NULL, `status` NOT NULL default `'draft'::listing_status`, `price numeric(10,2)` **NULLABLE**, `currency` NULLABLE default `'USD'`, `category_tags jsonb` NULLABLE default `'[]'::jsonb`. **No CHECK on price.**
  - `marketplace_order`: `organization_id` NOT NULL (**no drift**), `listing_id`/`buyer_person_id`/`vendor_id` NOT NULL, `quantity integer` NOT NULL default `1`, `total_price numeric(10,2)` NOT NULL, `status` NOT NULL default `'pending'::order_status`. **No CHECK** (no `quantity >= 1`, no `total_price >= 0`).
  - Enums (live `pgEnum`): `vendor_status` = {pending,verified,suspended,rejected}; `vendor_category` = {emr,supplies,insurance,telehealth,other}; `listing_status` = {draft,active,archived}; `order_status` = {pending,confirmed,fulfilled,cancelled,refunded}.
- **Existing integration tests** (`*.repo.integration.test.ts` for all 3 repos): **genuine real-PG** (drive real Drizzle repos against live engine), BUT use a **transaction-rollback-on-shared-`public`** harness (`createDatabase({url})` + `db.transaction(async tx => { ...; throw ROLLBACK })`), **NOT `createScratch`**. Skip-only via `const SKIP = !process.env['DATABASE_URL']` — **NOT CI-gated** (no `if(process.env.CI)return`), so they run in any DB-backed lane. They carry **brittle prototype-mock-restoration machinery** (`capturePristine`/`restorePristine`, cache-busted `import('./vendor.repo?pristine=...')`) because sibling handler test files (`listing-order.test.ts`, `order-discovery.test.ts`) `mock()` repo prototype methods and never restore them. This is the B4 hand-rolled-harness smell: faithful but not `createScratch`, and the rollback-on-public approach lets a thinner shared-`public` schema mask nothing today (public IS the migrated schema) — the real fragility is the mock-restoration coupling, not DDL drift.
- **Handlers (13):** `createVendor`, `getVendor`, `listVendors`, `updateVendor`, `verifyVendor` (decision-driven verify/reject/suspend), `createListing`, `listListings`, `updateListing` (FSM-driven status), `createOrder`, `listOrders`, `getOrder`, `fulfillOrder`, `cancelOrder`. All have mock-based unit tests today (`vendor-crud.test.ts`, `verifyVendor.test.ts`, `listing-order.test.ts`, `order-discovery.test.ts`, `updateListing.test.ts`, `cancelOrder.test.ts`, `getOrder.test.ts`, `listOrders.test.ts`).
- **Org-scoping:** route prefix `/association/marketplace/*` is gated by `featureFlagGate('marketplace')` (app.ts:444) atop fail-open `orgContext`. `organizationId` is read from `ctx.get('organizationId')`. Cross-org reads are guarded handler-side: `createOrder`/`fulfillOrder`/`cancelOrder`/`updateListing` all do `if (!row || row.organizationId !== organizationId) throw NotFoundError` (createOrder.ts:35, fulfillOrder.ts:33, cancelOrder.ts:36, updateListing.ts:39). `listOrders`/`listVendors`/`listListings` force `organizationId` into the filter. **These guards are unit-tested with mocks but never proven against real PG rows (cross-org isolation IDOR).**
- **FSMs** (`utils/status-transitions.ts:105-124`):
  - `MARKETPLACE_VENDOR_VALID_TRANSITIONS`: pending→[verified,rejected], verified→[suspended], suspended→[verified], rejected→[] (terminal).
  - `MARKETPLACE_LISTING_VALID_TRANSITIONS`: draft→[active], active→[archived], archived→[] (terminal).
  - `MARKETPLACE_ORDER_VALID_TRANSITIONS`: pending→[confirmed,fulfilled,cancelled], confirmed→[fulfilled,cancelled], fulfilled→[refunded], cancelled→[] (terminal), refunded→[] (terminal).
- **Dead/un-driven order states (real finding):** the order FSM and `order_status` enum include `confirmed` and `refunded`, but **NO handler ever produces them** — `createOrder` always writes `status:'pending'` (createOrder.ts:64); there is no `confirmOrder` and no `refundOrder` handler. `OrderRepository` has only `fulfillOrder`/`cancelOrder`. The integration test seeds `status:'confirmed'` directly to exercise filters. So `pending→confirmed`, `confirmed→fulfilled`, `fulfilled→refunded` are FSM-reachable but **unreachable through any prod entrypoint**. Classify per slice (characterization + product decision, NOT silently add handlers).

### HARNESS NOTE — peripheral cluster, no shared fixture

Unlike B1 (scheduling) which shared one `scheduling-fixtures.ts`, the Wave-3 peripheral modules (marketplace / advertising / audit / jobs / onboarding) are **self-contained schemas with near-zero mutual coupling** — same posture as Wave-2 B4. marketplace builds its OWN `createScratch(['vendor','marketplace_listing','marketplace_order'])` harness (Slice 1); no cross-module fixture. FKs are dropped by `LIKE`, so the suite seeds vendor/listing rows directly without needing `organization`/`person` parents.

---

### Slice 1 — Migrate the 3 repo integration suites off transaction-rollback-on-`public` onto `createScratch`; kill the mock-restoration machinery — DoD #1
- **axis:** integ (harness — highest leverage)
- **files to CREATE/EDIT:** rewrite in place `repos/vendor.repo.integration.test.ts`, `repos/listing.repo.integration.test.ts`, `repos/order.repo.integration.test.ts` to use `createScratch(['vendor','marketplace_listing','marketplace_order'])` from `@/test-utils/pg-scratch`. Construct repos against `H.db` (`new VendorRepository(H.db as any)`), guard every test `if (!H.dbReachable) return`, `afterAll(() => H?.teardown())`. **Remove** the `capturePristine`/`restorePristine`/`?pristine=Date.now()` prototype-snapshot machinery entirely — `createScratch` runs the repo against an isolated schema with the genuine prototype (no shared `db.transaction`, no rollback, no cross-file mock bleed), so the brittle restoration is no longer needed.
- **asserts (real outcomes against Postgres — preserve current behavioral assertions, now on `createScratch`):**
  - vendor `createOne` round-trips: read back via `H.scopedPool.query` → `verification_status='pending'` (DB default applied when omitted), `organization_id` persisted exactly, `version=1`.
  - org-scoping isolation on real rows: seed 2 vendors in orgA + 1 in orgB → `findMany({organizationId: orgA}).length === 2` and none is orgB's (proves the `eq(organization_id,...)` WHERE binds on real PG, not a mock).
  - listing `categoryTag` JSONB containment: `findMany({categoryTag: uniqueTag})` returns exactly the row whose `category_tags @> '["uniqueTag"]'` — proves the raw `sql\`... @> ...\`` operator parses on real PG.
  - order filter branches (org/buyer/vendor/listing/status) each return the expected subset against seeded rows.
- **est commits:** 2 (1 vendor+listing migration + drop machinery; 1 order migration + verify all green under DB-backed lane)

### Slice 2 — Vendor FSM (BR-38 verification lifecycle) proven at the SQL boundary — DoD #2
- **axis:** BR (covers BR-38 vendor verification gate)
- **files to CREATE:** extend `repos/vendor.repo.integration.test.ts` (Slice 1 suite).
- **asserts (real persisted rows + real enum values):**
  - `verifyVendor(id, admin)`: pending→ row read-back has `verification_status='verified'`, `verified_by=admin`, `verified_at IS NOT NULL` (timestamp column actually stamped, not null).
  - `suspendVendor(id, by)` on a `verified` row → `verification_status='suspended'`; calling on a `pending` row → `ConflictError` (`assertValidTransition` fires; assert the thrown class, not a 200).
  - `rejectVendor(id, by)` on `pending` → `verification_status='rejected'` (terminal); on `verified` → `ConflictError`.
  - NotFound: any FSM method on a random UUID → `NotFoundError`.
  - **enum integrity:** attempt a raw insert of `verification_status='bogus'` via `H.scopedPool` → Postgres invalid-enum-input error `code === '22P02'` (proves the `vendor_status` enum is enforced by the live column type copied by `LIKE INCLUDING ALL`, not just the Drizzle type).
- **est commits:** 1

### Slice 3 — Listing lifecycle + createListing "vendor must be verified" gate (BR-38 cont.) — DoD #2
- **axis:** BR
- **files to CREATE:** extend `repos/listing.repo.integration.test.ts`; add a thin handler-level test `createListing.integration.test.ts` driving the REAL `ListingRepository`+`VendorRepository` via `createScratch` (not stubRepo).
- **asserts:**
  - lifecycle: insert `draft` listing → `updateOneById(id,{status:'active'})` persists `status='active'` and bumps `version` (read-back `version > 1`); → `'archived'` persists. (`MARKETPLACE_LISTING_VALID_TRANSITIONS` is handler-enforced in `updateListing`, not repo-enforced — characterize: repo `updateOneById` will write ANY status, so the FSM guard lives only in the handler; assert that explicitly.)
  - **createListing verified-vendor gate (BR-38, real bug surface if bypassed):** seed a `pending` vendor → `createListing` handler throws `BusinessLogicError('Vendor must be verified before creating listings')` (createListing.ts:37-39) BEFORE any listing row is inserted → assert `marketplace_listing` count for that vendor is **0** (no orphan draft). Seed a `verified` vendor → listing row persists with `status='draft'`, `currency='USD'` default applied.
  - `findActiveListingsByVendor` returns only `status='active'` rows for that vendor (insert active+active+draft → length 2).
  - **enum integrity:** raw insert `status='bogus'` → `22P02` on `listing_status`.
- **est commits:** 2

### Slice 4 — Order placement guards + total_price math at the boundary (createOrder) — DoD #2/#3
- **axis:** BR (covers order placement business rules G-04/G-11)
- **files to CREATE:** `createOrder.integration.test.ts` driving the REAL repos via `createScratch`.
- **asserts (real persisted rows — these guards are app-only today, NO DB CHECK backs them):**
  - happy path: active listing `price='99.99'`, quantity=2 → order row persists with `total_price='199.98'` (the `(unitPrice*quantity).toFixed(2)` math, createOrder.ts:53), `status='pending'`, `buyer_person_id=user.id`, `vendor_id` copied from the listing.
  - **inactive-listing guard:** listing `status='draft'` → `BusinessLogicError('Listing is not active')` (createOrder.ts:38) and assert `marketplace_order` count === 0 (no order created against a non-buyable listing).
  - **price-less guard (G-11):** active listing with `price=NULL` → `BusinessLogicError('Listing has no price set...')` (createOrder.ts:46) and 0 orders. This is the load-bearing "don't silently charge 0" control; prove it fires against a real NULL price column (which is genuinely nullable per catalog).
  - **quantity guard:** `quantity=0` → `ValidationError('Quantity must be at least 1')` (createOrder.ts:43), 0 orders. **Flag:** the DB has NO `quantity >= 1` CHECK (verified catalog) — the only guard is app-layer; assert that a raw insert of `quantity=0` via `H.scopedPool` SUCCEEDS (documents the missing DB invariant). This is a **characterization of a defense-in-depth gap**, not a red-then-fix (adding a CHECK migration is a product decision; the app guard already protects the real path). Note in commit.
  - **cross-org IDOR:** listing in orgB; createOrder with `organizationId=orgA` (ctx) → `NotFoundError('Listing not found')` (createOrder.ts:35) and 0 orders — proves cross-org order placement is blocked at the real row level.
- **est commits:** 2

### Slice 5 — Order state machine: fulfill / cancel + dead `confirmed`/`refunded` characterization — DoD #2
- **axis:** BR
- **files to CREATE:** extend `repos/order.repo.integration.test.ts` + a handler-level block in `createOrder.integration.test.ts` (or a small `order-lifecycle.integration.test.ts`).
- **asserts:**
  - `fulfillOrder(id, by)` on a `pending` order → `status='fulfilled'`, `fulfilled_at IS NOT NULL`, `updated_by=by` (read-back). Handler path (`fulfillOrder.ts`) `assertValidTransition(pending→fulfilled)` allowed; on a `cancelled` order → `ConflictError` (illegal transition).
  - `cancelOrder(id, by)` on `pending` → `status='cancelled'`; on `fulfilled` → `ConflictError` (fulfilled has no →cancelled edge).
  - **Dead-state contract (real finding, characterization + product decision):** assert there is NO handler that produces `status='confirmed'` or `status='refunded'` — i.e. `createOrder` always writes `pending` (read-back the only insert path). Document in the commit that `confirmed`/`refunded` are FSM-reachable but un-driven (no `confirmOrder`/`refundOrder` handler, no repo method); raise as a product decision (should buyers confirm? should there be a refund flow tied to billing?) rather than silently adding handlers. Assert the FSM table itself permits `pending→confirmed` and `fulfilled→refunded` so the gap is visible if a handler is later added.
  - **enum integrity:** raw insert `status='bogus'` → `22P02` on `order_status`.
- **est commits:** 1

### Slice 6 — Cross-org isolation / IDOR for mutate + read handlers (real-PG) — DoD #4 (inter-module contract = org boundary)
- **axis:** inter-module (org-scoping contract)
- **files to CREATE:** `marketplace-org-isolation.integration.test.ts` driving the REAL handlers' repos via `createScratch`.
- **asserts (real rows across two orgs):**
  - `updateListing` on a listing owned by orgB, caller ctx `organizationId=orgA` → `NotFoundError` and the orgB row is **unchanged** (read-back `status` + `version` identical) — proves no cross-org mutation leaks.
  - `fulfillOrder` / `cancelOrder` on an orgB order from orgA → `NotFoundError`, orgB order `status` unchanged.
  - `listOrders` with ctx `organizationId=orgA` never returns orgB orders even with a matching `buyerPersonId`/`vendorId` filter (the forced org filter in listOrders.ts:35 wins). Seed orgA + orgB orders sharing a vendorId → assert orgA list excludes orgB rows.
  - `listVendors`/`listListings` likewise org-bounded.
  - **getVendor/getOrder cross-org:** confirm a get of an orgB resource from orgA context returns NotFound (characterize whichever guard exists; if `getVendor` lacks an org check, that is a real IDOR bug → red-test then fix the handler to add the `row.organizationId !== organizationId` guard mirroring the others). Verify `getVendor.ts`/`getOrder.ts` during execution.
- **est commits:** 2

### Slice 7 — Vendor FK cascade + order/listing referential integrity (real-PG, the FK chain) — DoD #2
- **axis:** integ
- **files to CREATE:** extend a repo integration suite (vendor or a small `marketplace-fk.integration.test.ts`). **Note:** `createScratch` drops FKs (`LIKE` never copies them), so true FK-cascade behavior CANNOT be proven in scratch. To exercise the `ON DELETE CASCADE` from `vendor → marketplace_listing`, this slice uses the **transaction-rollback-on-`public`** harness (the existing pattern) for the FK-specific cases ONLY, clearly commented as the deliberate exception, OR re-creates the FK inside the scratch schema after table creation. Prefer: a tx-rollback block (re-using `createDatabase`+`db.transaction(throw ROLLBACK)`) scoped to FK assertions, since the FKs only exist on `public`.
- **asserts:**
  - deleting a `vendor` cascades to its `marketplace_listing` rows (`marketplace_listing_vendor_id_vendor_id_fk ON DELETE CASCADE`) — after vendor delete, listing count for that vendor === 0.
  - deleting a `vendor` that has a `marketplace_order` (FK `marketplace_order_vendor_id_vendor_id_fk`, **NO cascade**) → Postgres FK violation `code === '23503'` (cannot orphan an order). Documents that orders pin vendors (intended).
  - inserting an order with a `listing_id` that doesn't exist → `23503` on `marketplace_order_listing_id_marketplace_listing_id_fk`.
- **est commits:** 1

### Slice 8 — Ratchet floor 5→40 + fix registry/coverage-threshold drift — DoD #5/#6 (FOLD INTO Wave-3 finalize)
- **axis:** integ/BR (housekeeping)
- **files to EDIT:** `services/api-ts/.coverage-thresholds.json` — raise `src/handlers/marketplace` from `{line:5, function:0}` toward `{line:40, function:40}` (set to the real measured module-min after slices 1–7 land; do not number-chase — the repo + handler real coverage should comfortably clear 40 given the breadth above). Update `docs/ver-3/business/br-registry.json` BR-38 (vendor verification) + any marketplace order/listing BR rows now backed by real-PG tests (drop stale MISSING/SHALLOW flags).
- **asserts:** `bun test` (api) green incl. the migrated `createScratch` integration suites in the DB-backed lane; coverage gate passes at the new floor; registry has no stale rows for items this plan made REAL.
- **est commits:** 1
- **NOTE:** this slice is the marketplace portion of the single Wave-3 finalize commit — fold the threshold + registry edits for all 5 peripheral modules into ONE finalize step rather than per-module.

---

**Totals:** 8 slices, ~12 commits. **Harness-first** (Slice 1) is the highest-leverage move: migrate the 3 genuine-but-hand-rolled (tx-rollback-on-`public` + brittle mock-restoration) suites onto `createScratch` and delete the restoration machinery. No real org_id drift (all 3 tables NOT NULL in both Drizzle + live — characterization, no migration). One real-finding to surface as **product decision** (not silent fix): the `confirmed`/`refunded` order states are FSM-reachable but un-driven by any handler (Slice 5). One defense-in-depth gap characterized (no DB CHECK on `quantity`/`total_price`; app-layer-only guard — Slice 4). One conditional red-then-fix flagged: getVendor/getOrder cross-org IDOR guard if absent (Slice 6).
