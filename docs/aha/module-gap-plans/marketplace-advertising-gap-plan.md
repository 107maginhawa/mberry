# AHA Module/Group Gap Plan: Marketplace/Ads/Reviews

Date: 2026-06-11 · Auditor: AHA prompt 02 · Status: RAW GAP PLAN (not fix-ready)

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Marketplace/Ads/Reviews |
| Module slug | marketplace-advertising |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m16-advertising.md`, `docs/product/modules/m17-marketplace.md` |
| Supporting PRDs/specs used | `docs/product/MODULE_SPEC.marketplace.md`, `docs/product/MODULE_SPEC.reviews.md`, `docs/quality/CONTRACT_COVERAGE.md` (D-11), `docs/ver-3/ux/screens/platform-admin/advertising-*.md`, `marketplace-vendors.md` |
| PRD/spec coverage quality | Strong (m16/m17 detailed; MODULE_SPECs current; reviews has no m-numbered PRD — MODULE_SPEC.reviews.md is primary) |
| Paths inspected | `services/api-ts/src/handlers/marketplace/`, `handlers/advertising/`, `handlers/reviews/` (all handlers + repos + schemas), `specs/api/src/modules/{marketplace,advertising,reviews}.tsp`, `services/api-ts/src/generated/openapi/routes.ts`, `specs/api/dist/openapi/openapi.json` (paths), `services/api-ts/src/middleware/org-context.ts`, `services/api-ts/src/app.ts` (middleware mounting), `services/api-ts/src/utils/status-transitions.ts`, `apps/memberry/src/routes/`, `apps/admin/src/`, `specs/api/tests/contract/{marketplace-flow,advertising-flow,reviews-flow,reviews}.hurl` |
| PRDs/specs inspected | m16, m17, MODULE_SPEC.marketplace, MODULE_SPEC.reviews, ver-3 platform-admin UX screen specs |
| KG used | Yes (status notes only — `docs/aha/kg/knowledge-graph-status.md`; per its guidance, direct code inspection was primary; KG marked partially stale) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status notes only — `docs/aha/kg/domain-knowledge-status.md`; product docs used as primary domain reference per its decision) |
| `/understand-domain` refreshed | No |
| Webwright used | No — Static review sufficient; browser tooling skipped for batch run. |
| Playwright/E2E inspected | Yes (static inspection of Hurl contract files only; no execution) |
| Existing tests inspected | 15 unit test files (3 marketplace, 7 advertising, 5 reviews) + 4 Hurl contract files |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No live server run; D-11 500-behavior taken from `docs/quality/CONTRACT_COVERAGE.md` + code-path analysis, not reproduced live. `listListings.ts` default status filter not fully read `[NEEDS CONFIRMATION]`. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| Module 16: Advertising | `docs/product/modules/m16-advertising.md` | PRD (full vision) | Current | Defines advertiser/campaign/creative lifecycle, business rules (mandatory creative review, sponsored label, no PII targeting, 3-reports-in-7-days auto-pause), admin screens, data entities. Implementation is a deliberate thin slice — entity model in PRD (placements, impressions, versioned creatives) is far richer than code. |
| Module 17: Marketplace | `docs/product/modules/m17-marketplace.md` | PRD | Current | Vendor verification, discovery, group purchasing, BR-38 (referral fee disclosure). Member-facing screens explicitly Phase 3; admin vendor screens "in scope for PRD v3". |
| MODULE_SPEC: marketplace | `docs/product/MODULE_SPEC.marketplace.md` | Implementation spec | Mostly current; §9 "Zero Hurl contract tests" is **stale** (marketplace-flow.hurl now exists); §3 claim that verifyVendor transitions to verified/rejected/suspended is **inaccurate** vs code | Handler inventory, schema, gotchas (no payment processing by design). |
| MODULE_SPEC: reviews | `docs/product/MODULE_SPEC.reviews.md` | Implementation spec | Current | NPS bounded context, invariants, person-deletion gotcha (cascade does not scrub reviews — flagged future work). |
| Contract coverage / defect log | `docs/quality/CONTRACT_COVERAGE.md` §"Pre-existing defects" | Defect record | Current | **D-11**: `/vendors`, `/listings`, `/orders`, `/advertisers`, `/campaigns`, `/creatives` insert paths skip `organization_id` → NOT NULL violation → 500; org-context middleware wired to `/association/*` only. |
| Platform-admin UX screens | `docs/ver-3/ux/screens/platform-admin/advertising*.md`, `marketplace-vendor*.md` | UX specs | Current | Admin screens for advertising + vendor management — none implemented in `apps/admin`. |

## 3. Expected vs Actual

**Expected (m17 + MODULE_SPEC.marketplace):** vendors register (pending) → platform admin verifies/rejects/suspends → verified vendor creates listings (draft → active) → members browse active listings and place orders → vendor fulfills. Admin vendor-management UI in scope for PRD v3; member browsing UI Phase 3 (deferred by spec).

**Actual:** all 9 marketplace handlers exist and are TypeSpec-generated and route-registered, with real state-machine enforcement (`utils/status-transitions.ts`). BUT: (a) every write route 500s in practice because the generated routes lost the `/association/marketplace` prefix so org-context middleware never runs and `organizationId` is `undefined` at insert (D-11); (b) there is **no endpoint to activate a listing** (`draft → active` transition unreachable — no updateListing/activateListing handler), so `createOrder` can never succeed against an API-created listing ("Listing is not active"); (c) `verifyVendor` hardcodes the target state `'verified'` — reject/suspend transitions defined in `MARKETPLACE_VENDOR_VALID_TRANSITIONS` are unreachable via API; (d) zero frontend consumers in either app.

**Expected (m16):** advertiser registration, campaign booking against admin-configured placements, mandatory creative review, member reporting with 3-reports/7-day auto-pause + admin alert, member opt-out honored in ad selection, impression tracking + analytics. Much of m16 is a later-phase vision `[INFERRED: thin-slice intent — audit index ranks this group "Lower risk, later"]`.

**Actual:** thin slice implements the four core safety principles in code comments (approval gate, PII-targeting rejection, sponsored label, opt-out) but two of them are hollow: `setMemberOptOut` writes nothing to the `member_ad_opt_out` table (logs + returns success only), and `getAdForPlacement` honors opt-out only via a **client-supplied query flag**. `reportAd` never inserts a report row (the `ad_report` table is dead), so the auto-pause counter is permanently 0+1 and the threshold is 5 (spec: 3 within rolling 7 days). `getAdForPlacement` serves any `approved` creative regardless of campaign status, schedule, or budget.

**Expected (MODULE_SPEC.reviews):** one NPS row per (context, reviewer, reviewType), 0–10 score, immutable (delete-only), role-based listing.

**Actual:** reviews is the healthiest sub-module — schema constraints (UNIQUE, CHECKs, FK RESTRICT) match spec exactly, handlers enforce duplicate-conflict, owner-or-admin delete, and role-scoped listing. Gaps are secondary (org scoping on list, person-deletion cascade `[CROSS-MODULE RISK]`).

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| m17 Vendor registration (pending status) | Vendor created `pending` with company/contact/category validation | Implemented in handler; 500s at runtime (D-11) | None | `handlers/marketplace/createVendor.ts`; route `POST /vendors` (routes.ts:3522) | `vendor` table, `vendor_status` enum | `vendor-crud.test.ts`; `marketplace-flow.hurl` step 2 (tolerates 500) | Partially Implemented | Yes — G-01 |
| m17 Vendor verification (approve/reject/suspend by platform admin) | Admin reviews and approves **or rejects**; suspend/revoke possible | Only `pending → verified` reachable; reject/suspend transitions exist in map but no API path; role is `association:admin` not platform admin | None (`/admin/marketplace/vendors` screens absent) | `verifyVendor.ts` (hardcoded `'verified'`); `status-transitions.ts:113-118` | `vendor_status` enum has `rejected`/`suspended` | `verifyVendor.test.ts` | Partially Implemented | Yes — G-05, G-06, G-07 |
| m17 Verified-vendor gate on listings | Listings only by verified vendors | `createListing` checks `verificationStatus === 'verified'` | None | `createListing.ts` | `marketplace_listing` FK → vendor | `listing-order.test.ts` | Implemented (but blocked by D-11 at runtime) | Yes — G-01 |
| m17 Listing lifecycle draft → active → archived | Listing publishable so members can buy | **No activate/update/archive endpoint exists** — created `draft`, transition map defined but unreachable | None | Only `createListing.ts` + `listListings.ts`; `MARKETPLACE_LISTING_VALID_TRANSITIONS` (status-transitions.ts:120-124) unconsumed for listings | `listing_status` enum | None | Missing | Yes — G-04 |
| m17 Member places order; vendor fulfills | Order pending → confirmed → fulfilled / cancelled / refunded | `createOrder` (active-listing check, total = price×qty) + `fulfillOrder` (transition-guarded) only; no confirm/cancel/refund/list/get endpoints; `OrderRepository.cancelOrder` unwired | None | `createOrder.ts`, `fulfillOrder.ts`; `order.repo.ts` (`cancelOrder` dead) | `marketplace_order`, `order_status` enum | `listing-order.test.ts`; hurl steps 8–9 (tolerate 500) | Partially Implemented | Yes — G-08 |
| m17 Discovery (browse by category/rating/search) | Filtered, sorted member browsing | `listListings` with `categoryTag` JSONB containment filter; no rating/sort (no rating data wired from reviews) | No member UI (Phase 3 by spec) | `listListings.ts`, `listing.repo.ts` | `category_tags` jsonb | hurl step 6 | Partially Implemented (rating sort Not Required for V1 — Phase 3) | Deferred |
| m17 BR-38 referral fee disclosure | Disclosure on detail page + adoption flow | Nothing (no fee fields, no UI) | None | None | None | None | Not Required for V1 `[INFERRED — Phase 3 member UI]` | Deferred |
| m17 Payment for orders | TBD per MODULE_SPEC §2/§9 (explicitly out of scope) | Not implemented, by documented design | — | — | No payment fields | — | Not Required for V1 `[NEEDS PRODUCT DECISION]` for when | No |
| m16 Creative review mandatory before display | No unapproved creative ever delivered | `createCreative` defaults `pending`; `reviewCreative` approve/reject with required rejection reason; `getAdForPlacement` filters `status:'approved'` | None | `createCreative.ts`, `reviewCreative.ts`, `getAdForPlacement.ts` | `creative_status` enum default `pending` | `createCreative.test.ts`, `reviewCreative.test.ts`, `getAdForPlacement.test.ts` | Implemented (runtime-blocked by D-11 for creates) | Yes — G-01 |
| m16 Sponsored label always rendered | Platform-enforced label on every impression | `sponsoredLabel: true` forced in handler + schema default | No member feed UI renders ads | `getAdForPlacement.ts` (`sponsoredLabel: true // Always enforce`) | `sponsored_label` boolean NOT NULL default true | `getAdForPlacement.test.ts` | Implemented (API-level) | No |
| m16 No PII targeting | Reject PII fields in campaign targeting | `createCampaign` rejects `targetEmail/targetPhone/targetName`; schema is segment-id based | — | `createCampaign.ts` (M16-R2 check) | `target_segment_id`/`target_segment_size` only | `createCampaign.test.ts` | Implemented | No |
| m16 Member opt-out honored in ad selection | Opt-out persisted; targeting excludes opted-out members | **`setMemberOptOut` persists nothing** (no DB write at all); `getAdForPlacement` trusts client query flag `optedOut` | None | `setMemberOptOut.ts` (logs only, returns success); `getAdForPlacement.ts` (`query.optedOut === 'true'`) | `member_ad_opt_out` table exists, never written/read | `setMemberOptOut.test.ts` (passes against the no-op!) | Missing (misleading: API claims success) | Yes — G-02 |
| m16 3 reports / 7 days auto-pause + admin alert + advertiser notification | Report rows persisted; rolling-window count; creative paused; alerts sent | `reportAd` **never inserts a report row** ("simulated" comment); threshold 5 not 3; no time window; pauses **campaign** not creative; no alert/notification | None | `reportAd.ts` (`REPORT_THRESHOLD = 5`; `countReports` then `+1` without insert); `creative.repo.ts countReports` | `ad_report` table exists, never written | `reportAd.test.ts` | Partially Implemented (effectively non-functional) | Yes — G-03 |
| m16 Campaign delivery respects status/schedule/budget (M16-R6) | Paused/completed/out-of-budget campaigns deliver nothing; CPM cap stops delivery | `getAdForPlacement` selects first approved creative — **no campaign status/schedule/budget check**; `budget_cents`/`spent_cents`/`starts_at`/`ends_at` columns never consulted at serve time | None | `getAdForPlacement.ts` | `ad_campaign` budget/schedule columns | None | Missing | Yes — G-09 |
| m16 Ad placements (admin-configured inventory, pricing) | `ad_placement` entity, pricing models, slot config screens | Only a static `ad_slot` enum (4 values); no placement table, no pricing | None | — | `ad_slot` pgEnum | — | Not Required for V1 `[INFERRED — later-phase ad-network buildout]` | Deferred |
| m16 Impression tracking + analytics (15-min freshness, CSV export) | `ad_impression` rows, aggregate dashboards | No impressions table; no analytics endpoints | None | — | None | — | Not Required for V1 `[INFERRED]` — but note G-09 dependency | Deferred |
| m16 Creative versioning (revision flow, `is_current`) | Versioned creatives, re-approval on revision | Single-row creative, no version fields | — | — | — | — | Not Required for V1 `[INFERRED]` | Deferred |
| m16 Advertiser suspension cascades to campaigns | Suspend advertiser → pause all campaigns | `advertiser.isActive` boolean exists; no suspend endpoint, no cascade | — | `advertiser.repo.ts` filter only | `is_active` boolean | — | Missing (V2) | Deferred |
| reviews: one review per (context, reviewer, type), 0–10, ≤1000 char | DB-enforced + 409 on duplicate | Fully implemented | Officer reviews route exists (`apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reviews/index.tsx`) `[NEEDS CONFIRMATION it consumes this module vs application reviews]` | `createReview.ts` (`reviewExists` → ConflictError) | UNIQUE + 3 CHECK constraints (`review.schema.ts`) | 5 unit test files; `reviews.hurl` full lifecycle incl. self-review rejection | Implemented | No |
| reviews: role-based listing + owner-only delete | Reviewer/reviewed-entity/admin visibility; owner-or-admin delete | Implemented (ForbiddenError paths; default scope = own reviews) | — | `listReviews.ts`, `deleteReview.ts`; route role `review:owner`/`admin` (routes.ts:3367) | — | `listReviews.test.ts`, `deleteReview.test.ts` | Implemented | Minor — G-12 (org scoping) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| All m16/m17 write operations must work | **G-01** Generated routes dropped the TypeSpec namespace prefix (`@route("/association/marketplace")` → OpenAPI `/vendors`, `/listings`, `/orders`, `/opt-out`, `/placement`, `/campaigns`, `/creatives`, `/advertisers`), so `/association/*`-mounted org-context middleware never runs; `ctx.get('organizationId')` is undefined; every insert hits `organization_id` NOT NULL → 500 | P0 | V1 REQUIRED | `specs/api/src/modules/marketplace.tsp:286`, `advertising.tsp:274`; `specs/api/dist/openapi/openapi.json` paths; `routes.ts:3522` etc.; `app.ts:418-431`; `docs/quality/CONTRACT_COVERAGE.md` D-11; hurl specs tolerate 500 | Fix prefix emission in spec/codegen (or re-route under `/association/...`), or mount `orgContextMiddleware` on the marketplace/advertising route groups. `[SHARED DEPENDENCY]` — touches TypeSpec build + `app.ts`; same root cause likely affects other prefix-less groups (`/postings` job board visible at routes.ts:3285) `[CROSS-MODULE RISK]` |
| m16 opt-out (M16-R4 / AC-M16-004) | **G-02** `setMemberOptOut` is a no-op (returns success, persists nothing); serve-side opt-out trusts client query param | P1 | V1 REQUIRED | `handlers/advertising/setMemberOptOut.ts` (no repo import/DB write); `getAdForPlacement.ts` `query.optedOut` check; unused `member_ad_opt_out` table in `advertising.schema.ts` | Persist opt-out row; have `getAdForPlacement` read the table by `user.id`; remove client-controlled flag |
| m16 report → auto-pause rule | **G-03** `reportAd` never inserts into `ad_report`; count is always 0+1; threshold 5 vs spec 3; no rolling 7-day window; pauses campaign not creative; no admin alert / advertiser notification | P1 | V1 REQUIRED (persist + threshold 3 + window); notifications V1 RECOMMENDED | `handlers/advertising/reportAd.ts` (`REPORT_THRESHOLD = 5`, "simulated" comment); `creative.repo.ts countReports`; m16 §4 "Member ad feedback triggers review" | Insert report row, count within 7-day window, threshold 3, set creative non-servable; emit notification via existing notifs pattern |
| m17 listing lifecycle | **G-04** No endpoint to move a listing `draft → active` (or archive) — the member buy flow is unreachable end-to-end | P1 | V1 REQUIRED | Handler dir has no updateListing/activateListing; `MARKETPLACE_LISTING_VALID_TRANSITIONS` (status-transitions.ts:120) has no caller for listings; `createOrder.ts` rejects non-active listings | Add `updateListing` (PATCH, transition-guarded) via TypeSpec pipeline |
| m17 vendor verification (reject/suspend) | **G-05** `verifyVendor` hardcodes target `'verified'`; `rejected`/`suspended` unreachable despite enum + transition map; MODULE_SPEC §3 documents reject/suspend as supported (doc mismatch) | P1 | V1 REQUIRED | `verifyVendor.ts` (`assertValidTransition(..., 'verified', ...)`); `status-transitions.ts:113-118`; `MODULE_SPEC.marketplace.md` §3 | Accept a decision body (`verified`/`rejected`/`suspended`) or add reject/suspend operations; correct MODULE_SPEC |
| m16/m17 platform-admin authority | **G-06** Creative review + vendor verification gated by `association:admin`, but PRDs assign both to **platform admin** (Memberry-level revenue/oversight); advertising implemented org-scoped while m16 says revenue + slot config are platform-level | P1 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | routes.ts:2866 (`reviewCreative` roles `["association:admin"]`), :3552 (`verifyVendor`); m16 §2 "Platform Admin Capabilities", §4 "Revenue to Memberry"; m17 "Platform admin reviews and approves" | Decide org-scoped vs platform-scoped model; if platform: move under `/admin/*` middleware chain (`app.ts:343`) |
| m17 `/admin/marketplace/vendors` screens (PRD v3 in scope) | **G-07** No admin UI anywhere — zero frontend consumers of marketplace/advertising/reviews APIs in `apps/admin` or `apps/memberry` | P1 | V1 RECOMMENDED | `grep -r` for vendor/listing/campaign/review hooks in both apps: no matches; `find apps/admin/src -iname '*market*|*vendor*|*advert*'`: empty; m17 Screens table ("Admin vendor management screens are in scope for PRD v3") | Build minimal admin vendor list + verify/reject screen after backend fixes |
| m17 order lifecycle completeness | **G-08** No confirm/cancel/refund endpoints; no listOrders/getOrder (buyer can't see orders; vendor has no way to discover orderId to fulfill); `OrderRepository.cancelOrder` dead code | P2 | V1 RECOMMENDED (listOrders + cancel); refund V2 DEFERRED | `handlers/marketplace/` file list; `order.repo.ts cancelOrder` unwired | Add `listOrders` + `cancelOrder` handlers via TypeSpec |
| m16 delivery gating (M16-R6) | **G-09** `getAdForPlacement` ignores campaign status/schedule/budget — paused/auto-paused/draft/expired campaigns still serve their approved creatives | P1 | V1 REQUIRED (status check; budget pacing can defer) | `getAdForPlacement.ts` (`findMany({organizationId, status:'approved'})` only); `ad_campaign.status/starts_at/ends_at/budget_cents` never read at serve time | Join/filter on campaign `status === 'active'` + date window; without this, G-03's pause has no effect |
| m17 cross-org isolation on orders | **G-10** `createOrder` fetches listing by id with no org check; `fulfillOrder` fetches order by id with no org/vendor-ownership check — any `association:admin/staff` of any org can fulfill any order | P2 | V1 RECOMMENDED | `createOrder.ts` (`findOneById(body.listingId)`), `fulfillOrder.ts` (`findOneById(orderId)`) | Scope lookups by `organizationId`; assert caller's vendor association on fulfill `[NEEDS PRODUCT DECISION: who is "the vendor user"? No vendor↔user link exists beyond optional `contact_person_id`]` |
| m17 order pricing integrity | **G-11** `createOrder` treats null listing price as 0 (`parseFloat(listing.price ?? '0')`) → free orders | P2 | V1 RECOMMENDED | `createOrder.ts` | Reject orders on price-less listings or require price at activation |
| reviews org scoping | **G-12** `listReviews` never filters by `organizationId` (column exists, "P0-7 multi-tenant scoping" comment); platform `admin` role sees all orgs; org officers have no org-scoped view | P2 | V1 RECOMMENDED | `listReviews.ts` (filters: context/reviewer/reviewType/reviewedEntity only); `review.schema.ts` `organizationId` + `reviews_org_idx` | Add org filter from ctx org context |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Root-level generic API paths `/opt-out`, `/placement`, `/orders`, `/listings`, `/vendors`, `/campaigns`, `/creatives`, `/advertisers` | `openapi.json` paths; routes.ts | Contradicts TypeSpec source (`/association/marketplace`, `/association/advertising`) — generation artifact, not product intent | High — namespace collisions (e.g. `/orders` vs any future commerce; `/placement` is meaningless at root) + the G-01 P0 | Fix as part of G-01; do not keep root paths |
| `reviewedEntity` person-to-person reviews + self-review rejection | `reviews.hurl` ("asserts that self-reviews are rejected"); `review.schema.ts reviewed_entity_id` | MODULE_SPEC.reviews documents it | Low | Keep |
| `assoc/order refund` status value (`refunded` in enum + transitions) with no payment system | `order_status` enum; `status-transitions.ts:129` | MODULE_SPEC says payment out of scope | Low — dead state | Do not expand; revisit with payment work `[DO NOT OVERBUILD]` |
| `ad_report` and `member_ad_opt_out` tables with zero readers/writers | `advertising.schema.ts`; no repo writes | Supported by m16 — tables are right, handlers are hollow | Medium — false sense of implementation | Keep tables; wire them (G-02/G-03) |
| `email_footer`/`event_sponsor` ad slots | `ad_slot` pgEnum | m16 formats are banner_top/banner_sidebar/sponsored_feed_post/directory_highlight — naming divergence | Low | Keep but clarify `[NEEDS CONFIRMATION]` mapping when ad delivery is actually built |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Vendor onboarding | Vendor rep / org staff → platform admin | Vendor wants to sell | register → admin verify/reject → (suspend later) | Register + verify-only; reject/suspend unreachable; runtime 500 (D-11); no UI | Yes (G-01, G-05, G-06, G-07) | §5 |
| Listing publication | Verified vendor | Verified vendor has offering | create draft → activate → members browse | Create + browse only; **no activation step** | Yes (G-04) | §5 |
| Member purchase | Member → vendor | Member finds listing | order pending → (confirm) → fulfill / cancel | create + fulfill only; no list/confirm/cancel; no ownership checks | Yes (G-08, G-10) | §5 |
| Ad campaign lifecycle | Advertiser (via org staff) → platform admin | Advertiser books campaign | advertiser → campaign → creative → review → serve | All create + review steps exist (500-blocked); serve ignores campaign state | Yes (G-01, G-09) | §5 |
| Ad safety loop | Member → system → admin | Member reports ad | report persisted → 3-in-7d → creative paused → alert | Effectively non-functional (no persistence, wrong threshold/scope, no alert) | Yes (G-03) | §5 |
| Ad privacy opt-out | Member | Member opts out | preference persisted → serve respects it | No-op persistence; client-controlled flag at serve | Yes (G-02) | §5 |
| NPS review lifecycle | Any person | Completed interaction | create (unique) → list (role-scoped) → delete (owner/admin) | Implemented end-to-end at API level | Minor (G-12) | §4 |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Vendor registers | 201 with pending status | Partially Implemented | createVendor.ts correct; 500 at runtime via D-11 | V1 REQUIRED | Fix = G-01 |
| Admin verifies vendor | verified OR rejected w/ reason | Partially Implemented | verifyVendor.ts verified-only | V1 REQUIRED | G-05 |
| Admin suspends vendor | verified → suspended (cascade to listings `[INFERRED]`) | Missing | No endpoint; transitions map supports it | V1 RECOMMENDED | Listing cascade `[NEEDS PRODUCT DECISION]` |
| Vendor activates listing | draft → active | Missing | No handler | V1 REQUIRED | G-04 — blocks purchase flow |
| Member browses listings | Active listings, filterable | Partially Implemented | listListings.ts; default-status filter `[NEEDS CONFIRMATION]` | V1 REQUIRED | Verify draft listings aren't exposed to members |
| Member orders | total computed, pending order | Partially Implemented | createOrder.ts; D-11; null-price → 0 | V1 REQUIRED | G-01, G-11 |
| Vendor sees + fulfills orders | listOrders → fulfill (own org only) | Partially Implemented | fulfillOrder exists; no listOrders; no ownership check | V1 RECOMMENDED | G-08, G-10 |
| Buyer cancels order | pending/confirmed → cancelled | Missing | cancelOrder repo method unwired | V1 RECOMMENDED | G-08 |
| Campaign created (no PII targeting) | PII rejected | Implemented | createCampaign.ts M16-R2 check | — | Good |
| Creative reviewed | approve / reject+reason, pending-only | Implemented | reviewCreative.ts | — | Good (role question G-06) |
| Ad served | approved creative of **active, in-window, in-budget** campaign; opt-out honored server-side | Partially Implemented | getAdForPlacement.ts | V1 REQUIRED | G-02, G-09 |
| Member reports ad | persisted; 3-in-7d auto-pause; alerts | Partially Implemented (non-functional) | reportAd.ts | V1 REQUIRED | G-03 |
| Member opts out | persisted, enforced | Missing (silently fake) | setMemberOptOut.ts | V1 REQUIRED | G-02 |
| NPS create/list/delete | invariants enforced | Implemented | reviews handlers + schema | — | Good |
| Person deletion vs reviews | Reviews preserved (RESTRICT) per spec; deletion cascade must handle conflict | Partially Implemented | MODULE_SPEC.reviews §2: cascade "does not currently scrub reviews — flagged as future work"; FK RESTRICT | V1 RECOMMENDED | `[CROSS-MODULE RISK]` G-13: person deletion will fail while reviews exist |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Register vendor | Org staff | 201 pending | Partially Implemented (500) | Yes | V1 REQUIRED | G-01 |
| Verify / reject / suspend vendor | Platform admin | All three decisions | Partially Implemented | Yes | V1 REQUIRED | G-05, G-06 |
| Create + activate listing | Verified vendor | Listing reaches `active` | Partially Implemented | Yes | V1 REQUIRED | G-04 |
| Browse listings | Member | Active-only, filtered | Partially Implemented | `[NEEDS CONFIRMATION]` | V1 REQUIRED | §8 |
| Place order | Member | Priced order created | Partially Implemented (500, 0-price) | Yes | V1 REQUIRED | G-01, G-11 |
| View own orders | Member/vendor | listOrders | Missing | Yes | V1 RECOMMENDED | G-08 |
| Fulfill order | Vendor | Own orders only | Partially Implemented | Yes | V1 RECOMMENDED | G-10 |
| Cancel order | Buyer/vendor | pending/confirmed → cancelled | Missing | Yes | V1 RECOMMENDED | G-08 |
| Refund order | Admin | fulfilled → refunded | Missing | No | V2 DEFERRED | No payment system yet |
| Create advertiser/campaign/creative | Org staff | 201s | Partially Implemented (500) | Yes | V1 REQUIRED | G-01 |
| Review creative | Platform admin | approve/reject pending-only | Implemented | Role gap | V1 REQUIRED (role fix per G-06) | §5 |
| Serve ad | System | Gated by campaign state + opt-out | Partially Implemented | Yes | V1 REQUIRED | G-02, G-09 |
| Report ad | Member | Persisted, auto-pause 3/7d | Partially Implemented | Yes | V1 REQUIRED | G-03 |
| Opt out of targeted ads | Member | Persisted + enforced | Missing | Yes | V1 REQUIRED | G-02 |
| Admin vendor mgmt UI | Platform admin | List/verify screens | Missing | Yes | V1 RECOMMENDED | G-07 |
| Member marketplace UI | Member | Browse/detail/apply | Missing | No — explicitly Phase 3 | V2 DEFERRED | m17 Screens note |
| Advertiser self-service portal, placements config UI, ad analytics dashboards | Advertiser/admin | Per m16 §5 | Missing | No | V2 DEFERRED | m16 is later-phase vision |
| Submit/list/get/delete NPS review | Person | Full lifecycle | Implemented | Minor | — | G-12 |
| NPS trend aggregation | Org officer | Trends | Missing here by design (owned by `surveys`) | No | DO NOT ADD (here) | MODULE_SPEC.reviews §2 |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| G-01 Route prefix dropped → org-context never applied → all marketplace/advertising writes 500 | API/middleware/codegen | **P0** | V1 REQUIRED | `marketplace.tsp:286` + `advertising.tsp:274` vs `openapi.json` root paths; `app.ts:418` (`/association/*` mount); D-11 in `docs/quality/CONTRACT_COVERAGE.md`; handlers read `ctx.get('organizationId')` (e.g. `createVendor.ts`, `createCampaign.ts`) | Every core write workflow of both sub-modules is unusable; contract tests were degraded to tolerate 500s | Restore namespace prefix in generation (preferred — matches TypeSpec source) **or** mount `orgContextMiddleware` for these route groups; then tighten hurl assertions. `[SHARED DEPENDENCY]` `[CROSS-MODULE RISK]` (job-board `/postings` shows the same pattern) |
| G-02 Opt-out is a silent no-op + client-trusted at serve time | Backend/privacy | P1 | V1 REQUIRED | `setMemberOptOut.ts` (no DB write); `getAdForPlacement.ts` (`query.optedOut`) | Misleading success response on a privacy preference; spec AC-M16-004 violated; trivially bypassable | Persist to `member_ad_opt_out`; read server-side |
| G-03 Ad-report pipeline non-functional | Backend/safety | P1 | V1 REQUIRED | `reportAd.ts` (no insert, threshold 5, no window, pauses campaign); m16 §4 (3 reports / 7 days, creative-level, admin alert) | Member-safety mechanism advertised by spec does not work at all | Insert `ad_report` rows; 3-in-rolling-7-days; block creative from serving; notify admin (notifs pattern) |
| G-04 Listing can never become active | Backend/workflow | P1 | V1 REQUIRED | No update/activate handler; `MARKETPLACE_LISTING_VALID_TRANSITIONS` unconsumed | Member purchase flow dead-ends even after G-01 fix | Add `updateListing` via TypeSpec pipeline |
| G-05 Vendor reject/suspend unreachable | Backend/workflow | P1 | V1 REQUIRED | `verifyVendor.ts` hardcoded `'verified'` | Admin cannot reject bad vendors — verification gate is approve-only theater | Decision-based verify endpoint |
| G-06 Platform-admin vs association-admin authority mismatch | RBAC | P1 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | routes.ts:2866, :3552 vs m16/m17 platform-admin language | Wrong trust boundary: org staff approving ads/vendors that PRD assigns to Memberry staff | Product decision, then re-gate |
| G-07 Zero frontend (incl. PRD-v3-in-scope admin vendor screens) | Frontend | P1 | V1 RECOMMENDED | Empty greps across `apps/memberry` + `apps/admin`; m17 Screens table | Whole group is API-only; no human can run the workflows | Minimal admin vendor screen post-backend-fix; member UI stays Phase 3 |
| G-09 Ad serving ignores campaign status/schedule/budget | Backend | P1 | V1 REQUIRED | `getAdForPlacement.ts` | Paused (incl. auto-paused) campaigns keep serving — undermines G-03 and M16-R6 | Filter by campaign active + date window at serve |
| G-08 Order lifecycle endpoints missing (list/cancel/confirm) | Backend | P2 | V1 RECOMMENDED | handler dir; dead `cancelOrder` repo method | Vendors can't find orders; buyers can't cancel | Add listOrders + cancelOrder |
| G-10 No org/ownership scoping on order operations | Security | P2 | V1 RECOMMENDED | `createOrder.ts` / `fulfillOrder.ts` findOneById without org filter | Cross-org data manipulation by any org admin | Org-scope lookups; vendor-ownership check |
| G-11 Null-price listing → ₱0 order | Data integrity | P2 | V1 RECOMMENDED | `createOrder.ts parseFloat(listing.price ?? '0')` | Silent free orders | Reject or require price |
| G-12 listReviews not org-scoped | Data/RBAC | P2 | V1 RECOMMENDED | `listReviews.ts` vs `review.schema.ts organizationId` | Cross-org review exposure to platform admin queries; officers lack org view | Add org filter |
| G-13 Person deletion blocked by review FK RESTRICT; cascade doesn't handle reviews | Cross-module | P2 | V1 RECOMMENDED | MODULE_SPEC.reviews §2; `review.schema.ts` `onDelete: 'restrict'` ×2; `core/domain-event-consumers.ts` has no reviews subscriber | `person.deleted` cascade will hit FK errors for reviewers/reviewed persons | `[CROSS-MODULE RISK]` `[NEEDS PRODUCT DECISION]` (anonymize vs delete — spec says preserve NPS history) |
| G-14 Contract tests assert `^(201|400|409|500)$` | Tests | P1 | V1 REQUIRED (alongside G-01) | `marketplace-flow.hurl`, `advertising-flow.hurl`, `reviews-flow.hurl` headers + step assertions | No regression protection; a fixed module would still "pass" while broken | Tighten to exact statuses after G-01 lands `[TEST GAP]` |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Org staff registers vendor → admin verifies → vendor lists → member orders → vendor fulfills | End-to-end 2xx chain | Step 1 500s (D-11); even with org header, listing stays `draft` so order step always 400 "Listing is not active" | hurl `marketplace-flow.hurl` steps 2,7,8 annotated "D-11: 500 expected"; `createOrder.ts` active check; no activation endpoint | P0 (composite of G-01+G-04) | Hurl end-to-end with exact 201/200 assertions incl. listing activation step |
| Member opts out then requests ad | No targeted ad served | Opt-out not stored; ad still served unless client sends `optedOut=true` itself | `setMemberOptOut.ts`, `getAdForPlacement.ts` | P1 | Unit + contract: opt-out → placement returns `generic: true` without client flag |
| Member reports ad ×3 | Creative paused, admin alerted | Nothing persisted; threshold never reachable | `reportAd.ts` | P1 | Unit: 3 reports in window pause creative; 3 reports across 8 days don't |
| Admin pauses campaign (or auto-pause fires) → members stop seeing ad | No delivery | `getAdForPlacement` still serves the approved creative | `getAdForPlacement.ts` | P1 | Unit: paused campaign's creative not served |
| Admin rejects fraudulent vendor | `pending → rejected` | API only offers verify; vendor stays pending forever | `verifyVendor.ts` | P1 | Unit + contract: reject path |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `ad_report` table | Schema with no writers | `advertising.schema.ts` `adReports`; `reportAd.ts` never inserts | Safety rule inert | Wire in G-03 fix |
| `member_ad_opt_out` table | Schema with no readers/writers | `advertising.schema.ts` `memberAdOptOuts` | Privacy rule inert | Wire in G-02 fix |
| `OrderRepository.cancelOrder` | Dead repo method | `order.repo.ts` | Drift | Wire via G-08 or remove |
| `MARKETPLACE_LISTING_VALID_TRANSITIONS` | Transition map with no caller | `status-transitions.ts:120-124` | Dead invariant | Wire via G-04 |
| `vendor_status` values `rejected`/`suspended` + transitions | Enum states unreachable via API | `status-transitions.ts:113-118`; `verifyVendor.ts` | Approve-only gate | Wire via G-05 |
| Campaign `budget_cents`/`spent_cents`/`starts_at`/`ends_at` | Columns never consulted at serve time; `spentCents` never incremented | `advertising.schema.ts`; `getAdForPlacement.ts` | M16-R6 inert | Status/date check now (G-09); spend tracking V2 |
| `advertiser.is_active` | Flag with no suspend endpoint and no serve-time effect | `advertising.schema.ts`; `advertiser.repo.ts` filter only | Suspension cascade impossible | V2 DEFERRED |
| Entire API surface (all 20 ops) | Backend with no frontend consumers | grep across `apps/*` | Unvalidated by real usage | G-07 minimal admin UI |
| `listing.repo.ts findActiveListingsByVendor` | Helper with no caller `[NEEDS CONFIRMATION]` | `listing.repo.ts` | Minor | Leave |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| OpenAPI paths lost `/association/{marketplace,advertising}` prefix vs TypeSpec source | API/codegen | §10 G-01 | P0 | Fix generation; regenerate routes |
| `campaign_status` enum (6 states) vs m16 (9 states incl. `auto_paused`, `scheduled`, `pending_creative`) | schema/model | `advertising.schema.ts` vs m16 §7 | P3 (thin slice acceptable) | Defer; map `auto_paused` need into G-03 design (a paused-by-system flag or status) |
| No `ad_placement` / `ad_impression` tables (m16 entities) | schema/model | m16 §7 vs `advertising.schema.ts` | P2 (V2) | `V2 DEFERRED` — do not build until ad delivery is a real phase `[DO NOT OVERBUILD]` |
| `marketplace_order.total_price` computed from nullable `price` (0 fallback) | backend/service | `createOrder.ts` | P2 | G-11 |
| Order has no link to payment / no `confirmed` setter | schema + API | `marketplace.schema.ts`, handler dir | P2 | G-08; payment `[NEEDS PRODUCT DECISION]` |
| `review.context_id` has no FK (by design, flexible) | schema/model | `review.schema.ts` comment | P3 | Keep (documented) |
| Reviews FK RESTRICT vs person-deletion cascade | schema + cross-module | G-13 | P2 | Coordinate with person module |
| `vendors.organization_id` etc. NOT NULL with no DB default — fails loudly when middleware missing (good fail-closed behavior, bad UX as 500) | schema/migration | D-11 | covered by G-01 | After G-01, add contract test asserting 403 (not 500) when org header missing |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Org-context (membership verification) entirely absent on these routes — beyond the 500, **reads** like `GET /vendors`, `GET /listings` run with only `roles:["user"]` and no org membership check; org filtering depends on handler-supplied `organizationId` that is undefined | Multi-tenant isolation | routes.ts:3529, 3010; `org-context.ts` docblock ("Fails closed… 403"); handlers' `filters.organizationId` undefined → unscoped `findMany` `[NEEDS CONFIRMATION: whether list handlers throw or return cross-org data when organizationId is undefined]` | P0 (part of G-01) | Same fix as G-01; then add cross-org isolation tests |
| `reviewCreative` / `verifyVendor` gated to `association:admin` though PRD assigns platform admin | Authority model | G-06 | P1 | `[NEEDS PRODUCT DECISION]` |
| `fulfillOrder` lacks vendor-ownership and org checks | Object-level authz | G-10 | P2 | Scope by org + vendor link |
| Opt-out decision controlled by client query parameter | Privacy enforcement | G-02 | P1 | Server-side lookup |
| `createListing` restricted to `association:admin/staff` while MODULE_SPEC says "bearerAuth (vendor)" — there is no vendor role/identity concept at all | Role model gap | routes.ts:3004 vs MODULE_SPEC.marketplace §3 | P2 | `[NEEDS PRODUCT DECISION]`: vendor portal identity vs staff-mediated entry (current code implies staff-mediated — acceptable V1 if documented) |
| Reviews delete authMiddleware roles `["review:owner","admin"]` + handler-level owner check (defense in depth) | Reviews | routes.ts:3367; `deleteReview.ts` | OK | None |

## 15. Record Safety / Audit History Findings

(Financial-adjacent: orders/pricing; trust-sensitive: ad review decisions.)

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| No `x-audit` extensions on any marketplace/advertising/reviews operation — vendor verification, creative approve/reject, order fulfillment leave no audit-module trail (only pino logs) | Compliance audit | routes.ts registrations show no audit middleware between auth and validators for these ops; CLAUDE.md P1.5 pattern | P2 | Add `@extension("x-audit", …)` to verifyVendor, reviewCreative, fulfillOrder, deleteReview during fixes |
| Creative review history is last-write-only (`reviewed_by/reviewed_at/rejection_reason` overwritten; no review-history rows) | Ad governance | `creative.repo.ts approve/rejectCreative` | P3 | V2 — m16 review-history screen is deferred anyway |
| Reviews immutable-by-design (delete-only) preserved correctly | NPS integrity | no update handler; MODULE_SPEC.reviews | OK | None |

## 16. Knowledge Graph Findings

KG used as context only (per `docs/aha/kg/knowledge-graph-status.md`: partially stale, direct inspection primary). No KG regeneration performed.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Audit index (KG-informed) records group as backend-only with thin marketplace tests (3/9) and "memberry discover/" as supposed frontend consumer | `docs/aha/outputs/module-audit-index.md` rows 158, 200, 275 | `discover/` actually contains only `events.tsx` — **index's frontend mapping for marketplace is wrong**; no consumer exists | Correct index row in next index refresh; treat group as unwired-to-UI |
| Blast radius of G-01 fix: TypeSpec build + `services/api-ts` route generation + `app.ts` middleware ordering + hurl assertions | `app.ts:418-441`, generator pipeline (CLAUDE.md API-First) | Shared-platform change | Sequence first, alone, with regen + full contract rerun `[SHARED DEPENDENCY]` |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Advertising is a Memberry-level monetization domain (revenue to platform), not an association capability — code models it org-scoped | m16 §1 Revenue Model + §4 "Revenue to Memberry" vs `organization_id` on every advertising table | Authority + tenancy model may need redesign before any ad V1 launch | `[NEEDS PRODUCT DECISION]` (G-06); domain status notes already flagged "Advertising third-party integration unclear" |
| Marketplace V1 realistically = vendor registry + verification + listings catalog (staff-mediated), not transactional commerce (no payments) | MODULE_SPEC.marketplace §2/§9 | Keeps fix scope small: G-01/G-04/G-05 give a coherent catalog product | Don't expand into payments/refunds now `[DO NOT OVERBUILD]` |
| Reviews module is correctly vertical-neutral; NPS aggregation deliberately lives in `surveys` | MODULE_SPEC.reviews §2 | Prevents duplicate-source-of-truth | DO NOT ADD aggregation here |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No Webwright/Playwright executed; no meaningful browser journey exists for this group anyway (zero frontend — G-07).

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| No member or admin UI journeys exist to test | Static inspection | `apps/memberry/src/routes/discover/` (events.tsx only); empty admin grep | E2E for this group is currently impossible | Add E2E only after G-07 UI exists |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/marketplace/vendor-crud.test.ts` | backend/unit | Vendor create/get/list/update `[INFERRED from name]` | Medium |
| `handlers/marketplace/verifyVendor.test.ts` | backend/unit | Verify transition | Medium |
| `handlers/marketplace/listing-order.test.ts` | backend/unit | Listing creation + order create/fulfill | Medium |
| `handlers/advertising/*.test.ts` (7 files: createAdvertiser, createCampaign, createCreative, reviewCreative, reportAd, setMemberOptOut, getAdForPlacement) | backend/unit | One per handler | Medium — but `setMemberOptOut.test.ts` passes against a no-op and `reportAd.test.ts` against non-persisting logic → tests codify the broken behavior | 
| `handlers/reviews/*.test.ts` (5 files incl. `reviews-handlers.test.ts`) | backend/unit | Full reviews CRUD + invariants | High |
| `specs/api/tests/contract/marketplace-flow.hurl` | contract | All 9 operationIds — but assertions broadened to tolerate 500 (D-11) | Low |
| `specs/api/tests/contract/advertising-flow.hurl` | contract | All 7 operationIds — same 500 tolerance | Low |
| `specs/api/tests/contract/reviews-flow.hurl` | contract | 4 operationIds, broadened assertions | Low |
| `specs/api/tests/contract/reviews.hurl` | contract | Real lifecycle: create→list→get→delete + self-review rejection | High |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Failing contract test: vendor/listing/order/advertiser/campaign/creative creates return 201 with org context (and 403 without) | integration (Hurl) | Proves G-01 fixed; replaces 500-tolerant assertions | Before (RED for G-01) `[TEST GAP]` |
| Unit: `setMemberOptOut` persists row; `getAdForPlacement` returns generic for opted-out user **without** client flag | backend/unit | Current tests bless the no-op | Before G-02 fix |
| Unit: 3 reports within 7 days persist rows + stop serving creative; reports outside window don't trigger | backend/unit | G-03 rule | Before G-03 fix |
| Unit: listing activation transition (draft→active, active→archived; invalid transitions 409/422) | backend/unit | G-04 new endpoint | During |
| Unit: verifyVendor decision = rejected/suspended paths | backend/unit | G-05 | During |
| Unit: paused/expired campaign creative not served | backend/unit | G-09 | Before fix |
| Permission: cross-org fulfillOrder / createOrder attempts → 403/404 | permission/RBAC | G-10 | During |
| Unit: createOrder on null-price listing rejected | backend/unit | G-11 | During |
| Integration: `person.deleted` event with existing reviews — define expected outcome | integration | G-13 `[CROSS-MODULE RISK]` | Before (will drive product decision) |
| Regression: OpenAPI path snapshot asserting `/association/marketplace/*` prefixes post-G-01 | data/schema (spec) | Prevent prefix regression | During G-01 |
| E2E admin vendor verification journey | E2E/Playwright | Only after G-07 UI exists | After |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| TypeSpec → OpenAPI → routes generation pipeline (prefix emission) | shared/platform | G-01; `specs/api` build + `services/api-ts/scripts/generate.ts` | Fix touches generator/spec shared by all modules; `/postings` (job board) shows same symptom | `[SHARED DEPENDENCY]` `[CROSS-MODULE RISK]` — fix once at pipeline level, regenerate, rerun full contract suite |
| `orgContextMiddleware` mounting in `app.ts` | shared/platform | `app.ts:418-441` | Alternative G-01 fix point; ordering with auth matters | `[SHARED DEPENDENCY]` |
| `utils/status-transitions.ts` | shared/platform | Vendor/listing/order maps | New endpoints (G-04/G-05/G-08) consume it; don't fork per-module copies | Reuse as-is |
| `persons` table FKs from reviews (RESTRICT) + `core/domain-event-consumers.ts` | cross-module | G-13 | Person deletion lifecycle owned by person module | `[CROSS-MODULE RISK]` — coordinate; reviews subscriber addition follows documented pattern (CLAUDE.md P1.6) |
| Platform admin vs association admin role model | product decision | G-06 | Determines route mounting (`/admin/*` chain at app.ts:343 vs `/association/*`) | `[NEEDS PRODUCT DECISION]` before re-gating |
| notifs module (admin alert / advertiser notification for G-03) | cross-module | m16 §4; `notificationRepo.createNotificationForModule` pattern (CLAUDE.md) | Auto-pause alerting | Use existing pattern; keep minimal |
| Stripe/payments for marketplace orders | product decision | MODULE_SPEC.marketplace §2 "TBD"; audit index row 188 (stripe-mock TODO) | Blocks confirm/refund semantics | `[NEEDS PRODUCT DECISION]` — defer |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Restore `/association/marketplace` + `/association/advertising` prefixes in generated OpenAPI/routes (or mount org-context on these groups) | G-01 | P0 | V1 REQUIRED | Hurl 201-assertions + 403-without-org; OpenAPI path snapshot | Do first; everything else depends on it. Investigate why TypeSpec `@route` namespace prefix is dropped (likely missing `@service`/namespace nesting in the two .tsp files vs other modules — compare with a module that keeps its prefix). |
| Tighten the 3 Hurl flow files to exact statuses | G-14 | P1 | V1 REQUIRED | Themselves | Same batch as G-01 |
| Persist + enforce opt-out server-side | G-02 | P1 | V1 REQUIRED | Unit ×2 | Small, contained |
| Real report persistence + 3-in-7d window + creative-level pause + admin notification | G-03 | P1 | V1 REQUIRED (notify = V1 RECOMMENDED) | Unit ×3 | Decide creative "paused" representation (new status vs flag) — keep minimal |
| Add `updateListing` (PATCH w/ transition guard) | G-04 | P1 | V1 REQUIRED | Unit + contract | TypeSpec-first per CLAUDE.md workflow |
| Decision-based vendor verification (verify/reject/suspend) | G-05 | P1 | V1 REQUIRED | Unit ×3 | Fix MODULE_SPEC.marketplace §3 text too |
| Campaign-state gating in `getAdForPlacement` | G-09 | P1 | V1 REQUIRED | Unit | Status + date window only; budget pacing V2 |
| Re-gate creative review / vendor verification per authority decision | G-06 | P1 | V1 RECOMMENDED | Permission tests | Blocked on product decision |
| `listOrders` + `cancelOrder` handlers | G-08 | P2 | V1 RECOMMENDED | Unit + contract | Wire existing repo method |
| Org-scope + ownership checks on order ops | G-10 | P2 | V1 RECOMMENDED | Permission tests | Partially falls out of G-01 (org context present) |
| Reject orders on price-less listings | G-11 | P2 | V1 RECOMMENDED | Unit | One-line guard |
| Org filter in `listReviews` | G-12 | P2 | V1 RECOMMENDED | Unit | |
| Reviews subscriber in `domain-event-consumers.ts` (or documented RESTRICT policy) | G-13 | P2 | V1 RECOMMENDED | Integration | `[NEEDS PRODUCT DECISION]` anonymize vs block |
| `x-audit` extensions on verifyVendor / reviewCreative / fulfillOrder / deleteReview | §15 | P2 | V1 RECOMMENDED | Audit side-effect contract test exists as pattern (`audit-side-effects.hurl`) | Follow P1.5 pattern |
| Minimal admin vendor management screen | G-07 | P1 | V1 RECOMMENDED | E2E | After backend batch |
| Update stale MODULE_SPEC.marketplace §9 ("Zero Hurl contract tests") | doc drift | P3 | V1 RECOMMENDED | — | Doc-only |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Member-facing marketplace UI (`/marketplace/...` browse/detail/apply) | `V2 DEFERRED` | m17 explicitly defers to Phase 3 |
| Payments/refunds for marketplace orders (Stripe) | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | MODULE_SPEC §2 out of scope; refund state stays dormant |
| m16 full ad-network: `ad_placement` table + pricing models, `ad_impression` tracking, analytics dashboards, CSV export, CPM caps/pacing, creative versioning/revision flow, advertiser self-service portal, advertiser suspension cascade, estimated-reach computation | `V2 DEFERRED` `[DO NOT OVERBUILD]` | m16 is a later-phase vision; V1 only needs the safety rails (G-02/G-03/G-09) on the existing thin slice |
| Group purchasing / pricing tiers / EMR referral flows (m17 Key Specifications) | `V2 DEFERRED` | Phase 3 member commerce |
| BR-38 referral-fee disclosure UI | `V2 DEFERRED` | Belongs to Phase 3 product detail page |
| NPS aggregation/trends inside reviews module | `DO NOT ADD` | Owned by `surveys` (MODULE_SPEC.reviews §2) — duplicate source of truth |
| Review editing/updates | `DO NOT ADD` | Immutability is a deliberate invariant |
| Behavioral-targeting or member-level ad analytics of any kind | `DO NOT ADD` | m16 §4 explicitly prohibits |
| New vendor-portal identity/role system | `[NEEDS PRODUCT DECISION]` / `[DO NOT OVERBUILD]` | Staff-mediated entry acceptable for V1; full vendor auth is a platform-scale feature |

## 24. Audit Decision

**FAIL**

The core write workflows of both marketplace and advertising are unusable in practice: G-01 (P0) makes every create operation 500 (documented as defect D-11 and tolerated by the contract suite), and even with org context fixed, the marketplace purchase flow dead-ends because listings can never be activated (G-04) and vendors can never be rejected (G-05). Two of the advertising module's spec-mandated safety/privacy mechanisms are hollow implementations that report success while doing nothing (G-02 opt-out, G-03 reports). The reviews sub-module alone is V1-reliable at the API level. There is no UI for any of the three sub-modules. 1 P0, 8 P1, 6 P2 gaps.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Should advertising + vendor verification authority be platform admin (per m16/m17) or association admin (per current routes)? Determines route mounting, roles, and tenancy of `advertiser`/`campaign` tables. | `[NEEDS PRODUCT DECISION]` | G-06; wrong trust boundary if shipped as-is | Product (Elad) |
| Who is "the vendor" as an authenticated actor? Staff-mediated (current) vs vendor portal identity (MODULE_SPEC says "bearerAuth (vendor)"). | `[NEEDS PRODUCT DECISION]` | G-10 ownership checks and createListing gating depend on it | Product |
| On `person.deleted`, should reviews be anonymized, deleted, or block deletion (current FK RESTRICT)? | `[NEEDS PRODUCT DECISION]` | G-13 cross-module cascade will otherwise fail | Product + person-module owner |
| Does `listListings` default to active-only for non-admin callers, or expose drafts? | `[NEEDS CONFIRMATION]` | Possible draft-listing leak to members | Engineer during fix |
| Do list endpoints (`GET /vendors`, `GET /listings`) return cross-org data today when `organizationId` is undefined, or fail? | `[NEEDS CONFIRMATION]` | Determines whether G-01 is also a read-isolation P0 vs write-only | Engineer (run against seeded DB) |
| Is the memberry officer reviews route (`routes/_authenticated/org/$orgSlug/officer/reviews/`) a consumer of this reviews module or of membership applications? | `[NEEDS CONFIRMATION]` | Affects G-07 frontend scoping for reviews | Engineer |
| Is the marketplace/advertising group actually targeted for the current pilot (audit index: "Lower risk, later")? If not, G-07 UI and even G-08 could be deprioritized below other modules' fixes. | `[NEEDS PRODUCT DECISION]` | Sequencing of the whole fix plan | Product |

## 26. Notes for Gap Plan Organizer

- **Batch 1 (must be first, standalone): G-01 + G-14.** Shared-platform change (TypeSpec/codegen prefix or `app.ts` middleware mounting). Write RED Hurl assertions first (exact 201/403), fix, regenerate (`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`), rerun full contract suite — blast radius includes other prefix-less groups like `/postings` `[CROSS-MODULE RISK]`. Nothing else in this plan is verifiable until this lands.
- **Batch 2 (marketplace workflow completion): G-04, G-05, G-11**, then **G-08, G-10**. All TypeSpec-first; reuse `status-transitions.ts`. Update stale MODULE_SPEC.marketplace (§3 verify semantics, §9 hurl claim) in the same batch.
- **Batch 3 (advertising safety rails): G-02, G-03, G-09.** Self-contained backend fixes; existing unit tests for `setMemberOptOut`/`reportAd` currently bless broken behavior and must be rewritten RED-first, not preserved.
- **Blocked on product decisions: G-06** (authority model — blocks re-gating), **G-13** (review anonymization policy), vendor-identity question (blocks the strict version of G-10). Do not implement these until answered.
- **G-07 (admin UI)** only after Batches 1–2; member marketplace UI is V2 — do not build.
- **Do not implement** anything in §23: no placements/impressions/analytics/versioning, no payments, no NPS aggregation in reviews, no vendor portal identity system.
- **Tests to write first:** the RED contract assertions for G-01, opt-out persistence unit, report-window unit, paused-campaign serve unit (§20 rows 1–3, 6).
- **Severity caution for organizer:** G-01 is one root cause manifesting across ~14 routes — treat as a single fix item, not 14.
- Reviews sub-module needs only G-12/G-13 — keep its batch tiny; don't let marketplace scope bleed into it.
