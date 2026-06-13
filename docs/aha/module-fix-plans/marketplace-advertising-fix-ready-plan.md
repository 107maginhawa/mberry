# AHA Fix-Ready Plan: Marketplace/Ads/Reviews

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Marketplace/Ads/Reviews |
| Module slug | marketplace-advertising |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md` |
| Audit decision | FAIL (carried from gap plan §24: 1 P0, 8 P1, 6 P2) |
| Superpowers used | No — organizing was straightforward from gap-plan §26 organizer notes; `/using-superpowers` not invoked. Recorded per shared rule §12. |
| Organizer decision | PARTIALLY READY |
| Reason | Active P0/P1/P2 fixes have concrete file-level evidence and a clean root-cause ordering (G-01 first, then marketplace workflow completion, then advertising safety rails). However three meaningful items are blocked on product decisions (G-06 authority model, G-13 review-deletion policy, vendor-identity question behind strict G-10), and one read-isolation question behind G-01 needs runtime confirmation. The module cannot be fully fixed in one pass; it must run as sequenced batches. |
| Limitations | No live server run during organization (matches gap-plan limitation). `listListings` default status filter unconfirmed `[NEEDS CONFIRMATION]`. Whether list endpoints leak cross-org data when `organizationId` is undefined is unconfirmed `[NEEDS CONFIRMATION]` — determines if G-01 is also a read-isolation P0. G-01 root cause (TypeSpec namespace-prefix drop vs `app.ts` middleware mount) is identified but the exact codegen mechanism must be confirmed during the fix pass before choosing the fix point. |

## 2. Fix Strategy Summary

**Fix first (Batch A, standalone):** G-01 — the dropped `/association/{marketplace,advertising}` route prefix that bypasses `orgContextMiddleware` and makes every write 500 (defect D-11). This is one root cause manifesting across ~14 routes; treat it as a single fix item, not 14. It is a shared/platform change (TypeSpec build + `services/api-ts` route generation, or `app.ts` middleware mounting) with cross-module blast radius (`/postings` job-board shows the same symptom). Nothing else in the plan is verifiable until this lands, so it runs alone with RED Hurl assertions, full regeneration, and a full contract-suite rerun. G-14 (tighten the 500-tolerant Hurl assertions to exact statuses) rides in this same batch because the two are inseparable.

**Then (Batch B):** marketplace workflow completion — G-04 (no listing activation = dead purchase flow), G-05 (vendor reject/suspend unreachable), G-11 (null-price → ₱0 order), then G-08 (listOrders + cancelOrder) and G-10 (org/ownership scoping on order ops). All TypeSpec-first, reusing `utils/status-transitions.ts`. Update stale `MODULE_SPEC.marketplace.md` (§3 verify semantics, §9 hurl claim) in this batch.

**Then (Batch C):** advertising safety rails — G-02 (persist + server-side opt-out), G-03 (real ad-report persistence, 3-in-7-days, creative-level pause, admin notify), G-09 (campaign status/schedule gating at serve time). G-09 must land with/before G-03 because without it an auto-paused creative still serves. Existing `setMemberOptOut.test.ts` and `reportAd.test.ts` currently bless the broken behavior and must be rewritten RED-first, not preserved.

**Then (Batch D):** test hardening — the reviews-local fixes G-12 (org-scope `listReviews`) and the `x-audit` extension additions (§15) that are low-risk and improve trust/testability. Keep the reviews slice tiny; do not let marketplace scope bleed into it.

**Do not fix in active scope:** G-06 (authority model — blocked on product decision), G-13 (review anonymization-vs-block policy — blocked on product decision), strict G-10 vendor-ownership check (blocked on vendor-identity decision), G-07 admin UI (sequence after Batches A–B; it is V1 RECOMMENDED but should not start before the backend it consumes is reliable), and everything in §23 (placements/impressions/analytics/versioning, payments/refunds, NPS aggregation, vendor-portal identity).

**Major risks:** (1) G-01 is a shared codegen change — regression risk to every prefix-less route group; mitigate with OpenAPI path snapshot + full contract rerun. (2) Several existing unit tests encode broken behavior; they must be flipped RED before fixing, or fixes will appear to "pass" against wrong baselines. (3) Reviews is the only healthy sub-module — keep its changes minimal to avoid destabilizing it.

**One pass or multiple:** Multiple. Batch A must be standalone and land first. Batches B, C, D follow in order. Blocked items wait for product decisions.

## 3. Active Fix Scope

Only P0/P1/selected P2 and V1 REQUIRED / selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G-01 — Route prefix dropped (`/association/{marketplace,advertising}` lost) → `orgContextMiddleware` never runs → `organizationId` undefined → every write 500 (D-11) | P0 | V1 REQUIRED | A | Blocks every create workflow of both sub-modules; all other fixes depend on it | `marketplace.tsp:286`, `advertising.tsp:274`; `openapi.json` root paths; `routes.ts:3522`; `app.ts:418-431`; `docs/quality/CONTRACT_COVERAGE.md` D-11 |
| FIX-002 | G-14 — Contract tests assert `^(201\|400\|409\|500)$`, tolerating the 500s | P1 | V1 REQUIRED | A | No regression protection; a fixed module would still "pass" while broken; inseparable from FIX-001 | `marketplace-flow.hurl`, `advertising-flow.hurl`, `reviews-flow.hurl` headers + step assertions |
| FIX-003 | G-04 — No endpoint to move a listing `draft → active` (or archive); member buy flow dead-ends | P1 | V1 REQUIRED | B | Even after FIX-001, purchase flow is unreachable end-to-end | No update/activate handler in dir; `MARKETPLACE_LISTING_VALID_TRANSITIONS` (status-transitions.ts:120) unconsumed; `createOrder.ts` active-only check |
| FIX-004 | G-05 — `verifyVendor` hardcodes `'verified'`; reject/suspend unreachable | P1 | V1 REQUIRED | B | Verification gate is approve-only theater; admin cannot reject bad vendors | `verifyVendor.ts`; `status-transitions.ts:113-118`; `MODULE_SPEC.marketplace.md` §3 |
| FIX-005 | G-11 — `createOrder` treats null listing price as 0 → free orders | P2 | V1 RECOMMENDED | B | Silent ₱0 orders; data-integrity guard; one-line fix near G-04 work | `createOrder.ts` (`parseFloat(listing.price ?? '0')`) |
| FIX-006 | G-08 — No listOrders/getOrder/confirm/cancel endpoints; `OrderRepository.cancelOrder` dead | P2 | V1 RECOMMENDED | B | Vendors can't discover orders to fulfill; buyers can't cancel; wires existing dead repo method | `handlers/marketplace/` file list; `order.repo.ts cancelOrder` unwired |
| FIX-007 | G-10 — `createOrder`/`fulfillOrder` lookups have no org scoping (org-level isolation) | P2 | V1 RECOMMENDED | B | Cross-org order manipulation by any org admin; the org-scope half falls out of FIX-001 context being present | `createOrder.ts` (`findOneById(body.listingId)`), `fulfillOrder.ts` (`findOneById(orderId)`). NOTE: strict vendor-ownership half is BLOCKED on vendor-identity decision — see §9 |
| FIX-008 | G-02 — `setMemberOptOut` persists nothing; serve-side opt-out trusts client query flag | P1 | V1 REQUIRED | C | Misleading success on a privacy preference; AC-M16-004 violated; trivially bypassable | `setMemberOptOut.ts` (no DB write); `getAdForPlacement.ts` (`query.optedOut`); unused `member_ad_opt_out` table |
| FIX-009 | G-03 — `reportAd` never inserts; threshold 5 vs spec 3; no 7-day window; pauses campaign not creative; no alert | P1 | V1 REQUIRED (persist+threshold+window); admin notify = V1 RECOMMENDED | C | Spec-mandated member-safety mechanism does not work at all | `reportAd.ts` (`REPORT_THRESHOLD = 5`, "simulated"); `creative.repo.ts countReports`; m16 §4; unused `ad_report` table |
| FIX-010 | G-09 — `getAdForPlacement` ignores campaign status/schedule/budget; paused/expired campaigns still serve | P1 | V1 REQUIRED (status+date window); budget pacing deferred | C | Without it, FIX-009's auto-pause has no effect; violates M16-R6 | `getAdForPlacement.ts` (`findMany({organizationId, status:'approved'})` only); `ad_campaign.status/starts_at/ends_at` never read at serve |
| FIX-011 | G-12 — `listReviews` never filters by `organizationId` (column + index exist) | P2 | V1 RECOMMENDED | D | Cross-org review exposure to platform-admin queries; officers lack org-scoped view | `listReviews.ts` (no org filter); `review.schema.ts organizationId` + `reviews_org_idx` |
| FIX-012 | §15 — No `x-audit` extensions on verifyVendor / reviewCreative / fulfillOrder / deleteReview | P2 | V1 RECOMMENDED | D | Trust-sensitive decisions leave no audit-module trail; low-risk, follows P1.5 pattern | routes.ts registrations (no audit middleware); CLAUDE.md P1.5; existing `audit-side-effects.hurl` pattern |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| A — P0 core-workflow blocker + its regression net | Restore `/association/*` prefix so org-context runs; tighten 500-tolerant contract tests | FIX-001, FIX-002 | High (shared codegen / middleware; cross-module blast radius incl. `/postings`) | Run in current `04` pass FIRST, standalone. Requires shared/platform fix (`[SHARED DEPENDENCY]` `[CROSS-MODULE RISK]`). Regenerate spec+routes, rerun full contract suite. |
| B — Marketplace workflow completion | Listing activation, vendor reject/suspend, price guard, order list/cancel, order org-scoping | FIX-003, FIX-004, FIX-005, FIX-006, FIX-007 | Medium (new TypeSpec endpoints; reuses `status-transitions.ts`) | Run after Batch A lands (org context must be present). Separate `04` pass. Strict vendor-ownership portion of FIX-007 waits on product decision. |
| C — Advertising safety rails | Persist+enforce opt-out; real ad-report pipeline; campaign-state serve gating | FIX-008, FIX-009, FIX-010 | Medium (rewrites tests that bless broken behavior; touches notifs for alert) | Run after Batch A. Can run in its own `04` pass parallel-independent of Batch B (different files), but B and C should each be their own pass. FIX-010 must land with/before FIX-009. |
| D — Reviews scoping + audit hardening | Org-scope listReviews; add `x-audit` to trust-sensitive ops | FIX-011, FIX-012 | Low (small, contained; reviews is healthy) | Run later, after Batches A–C. Keep tiny. Separate `04` pass or appended to Batch C if scope stays small. |
| E — Shared/platform dependency | (Folded into Batch A.) TypeSpec→OpenAPI prefix emission or `orgContextMiddleware` mounting in `app.ts` | FIX-001 (shared portion) | High | Same as Batch A — NOT buried in a module-local batch. Fix once at pipeline level, regenerate, rerun full contract suite. |
| F — Database/schema dependency | None required. All needed tables (`ad_report`, `member_ad_opt_out`, `marketplace_listing/order`, `vendor_status`/`listing_status`/`order_status` enums) already exist; fixes wire existing schema, not change it. | (none) | — | Do not run — no schema migration in active scope. New `ad_report`/opt-out writes use existing columns. |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | RED: vendor/listing/order/advertiser/campaign/creative creates return 201 WITH org context, and 403 WITHOUT org context (not 500) | integration (Hurl) | Org-context middleware runs; `organizationId` resolved; writes succeed; fail-closed when org header absent | Update `specs/api/tests/contract/marketplace-flow.hurl` + `advertising-flow.hurl` (flip 500-tolerant assertions) |
| FIX-001 | RED: OpenAPI path snapshot asserts `/association/marketplace/*` and `/association/advertising/*` prefixes present | data/schema (spec) | Prevents future prefix-drop regression for these groups (and signals `/postings` class) | New snapshot/assertion against `specs/api/dist/openapi/openapi.json` (or extend existing OpenAPI path test if present) |
| FIX-002 | Tighten the 3 flow files to exact statuses (`201`/`200`/`403`/`409`) | integration (Hurl) / regression | A still-broken module fails the suite instead of passing on tolerance | `marketplace-flow.hurl`, `advertising-flow.hurl`, `reviews-flow.hurl` |
| FIX-003 | RED: listing activation transition (`draft→active`, `active→archived`; invalid transitions → 409/422) | backend/unit | New `updateListing` endpoint enforces `MARKETPLACE_LISTING_VALID_TRANSITIONS`; listing reaches `active` | New `handlers/marketplace/updateListing.test.ts`; extend `listing-order.test.ts` for end-to-end create→activate→order |
| FIX-004 | RED: verifyVendor decision = `rejected` and `suspended` paths reachable; invalid transitions rejected | backend/unit | Reject/suspend transitions usable via API; not approve-only | Extend `handlers/marketplace/verifyVendor.test.ts` |
| FIX-005 | RED: createOrder on null-price listing is rejected | backend/unit | No silent ₱0 order; price required at order/activation | Extend `handlers/marketplace/listing-order.test.ts` |
| FIX-006 | RED: listOrders returns caller-scoped orders; cancelOrder moves pending/confirmed → cancelled | backend/unit + contract | Vendor/buyer can discover and cancel orders; wires dead repo method | New `handlers/marketplace/listOrders.test.ts` + extend `listing-order.test.ts`; add steps to `marketplace-flow.hurl` |
| FIX-007 | RED: cross-org createOrder/fulfillOrder attempt → 403/404 (org-level) | permission/RBAC | Org-scoped lookups prevent cross-org manipulation | Extend `handlers/marketplace/listing-order.test.ts` (org-scope half only; vendor-ownership half deferred) |
| FIX-008 | RED: setMemberOptOut persists a row; getAdForPlacement returns generic for opted-out user WITHOUT a client flag | backend/unit | Opt-out is real and server-enforced; current no-op test rewritten | Rewrite `handlers/advertising/setMemberOptOut.test.ts`; extend `getAdForPlacement.test.ts` |
| FIX-009 | RED: 3 reports within 7 days persist rows + stop serving the creative; 3 reports across 8 days do NOT trigger | backend/unit | Report rows persisted; rolling-window count; threshold 3; creative-level pause | Rewrite `handlers/advertising/reportAd.test.ts` |
| FIX-010 | RED: paused/expired/draft campaign's approved creative is NOT served | backend/unit | Serve gated on campaign `status === 'active'` + date window | Extend `handlers/advertising/getAdForPlacement.test.ts` |
| FIX-011 | RED: listReviews scoped to caller's org; cross-org reviews not returned | backend/unit | Org filter applied from ctx org context | Extend `handlers/reviews/listReviews.test.ts` |
| FIX-012 | Audit side-effect assertion for verifyVendor / reviewCreative / fulfillOrder / deleteReview | regression / contract | Audit event emitted per P1.5 pattern after each op | Follow pattern of existing `audit-side-effects.hurl`; extend module unit tests if a unit-level audit assertion exists |

Do NOT create or modify tests during this prompt — the above is the planned RED-first sequence for `04`.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `specs/api/src/modules/marketplace.tsp`, `advertising.tsp` (namespace/`@route` nesting) OR `services/api-ts/src/app.ts` (mount `orgContextMiddleware` on these groups); regenerated `services/api-ts/src/generated/openapi/routes.ts` + `openapi.json` (via `bun run build` + `generate`, NOT hand-edited) | shared/platform | High — codegen pipeline + middleware ordering; same root cause likely affects other prefix-less groups (`/postings`); full contract suite must rerun |
| FIX-002 | `specs/api/tests/contract/marketplace-flow.hurl`, `advertising-flow.hurl`, `reviews-flow.hurl` | module-local (tests) | Low |
| FIX-003 | New `handlers/marketplace/updateListing.ts`; `marketplace.tsp` (new PATCH op); `listing.repo.ts`; reuse `utils/status-transitions.ts` | module-local (+ TypeSpec pipeline regen) | Low–Medium |
| FIX-004 | `handlers/marketplace/verifyVendor.ts`; `marketplace.tsp` (decision body); `MODULE_SPEC.marketplace.md` §3 text; reuse `status-transitions.ts` | module-local (+ doc) | Low |
| FIX-005 | `handlers/marketplace/createOrder.ts` | module-local | Low |
| FIX-006 | New `handlers/marketplace/listOrders.ts` (+ cancelOrder handler); `marketplace.tsp`; `order.repo.ts` (wire `cancelOrder`) | module-local (+ pipeline regen) | Low–Medium |
| FIX-007 | `handlers/marketplace/createOrder.ts`, `fulfillOrder.ts` (org-scope lookups) | module-local | Low |
| FIX-008 | `handlers/advertising/setMemberOptOut.ts`, `getAdForPlacement.ts`; opt-out repo (write/read `member_ad_opt_out`) | module-local | Low |
| FIX-009 | `handlers/advertising/reportAd.ts`; `creative.repo.ts` (insert report, windowed count, creative pause); notifs call for admin alert | module-local (+ cross-module notifs call, existing pattern) | Low–Medium |
| FIX-010 | `handlers/advertising/getAdForPlacement.ts`; campaign repo join/filter | module-local | Low |
| FIX-011 | `handlers/reviews/listReviews.ts` | module-local | Low |
| FIX-012 | `specs/api/src/modules/marketplace.tsp` / `advertising.tsp` / `reviews.tsp` (`@extension("x-audit", …)` on the 4 ops); regen | module-local (+ pipeline regen) | Low |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | shared/platform | TypeSpec → OpenAPI → routes generation (prefix emission) in `specs/api` build + `services/api-ts/scripts/generate.ts` | Fix touches generator/spec shared by all modules; must regenerate and rerun full contract suite | Yes — it IS the fix; isolate in Batch A |
| FIX-001 | shared/platform | `orgContextMiddleware` mounting in `app.ts:418-441` | Alternative fix point; ordering with auth middleware matters | Yes — decide fix point before implementing |
| FIX-001 | cross-module | `/postings` (job board) and any other prefix-less group | Same symptom likely present; regression rerun must cover them | Verify during fix; do not expand scope beyond confirming no regression |
| FIX-003/004/006 | shared/platform | `utils/status-transitions.ts` | New endpoints consume existing transition maps; do not fork per-module copies | Reuse as-is; no change needed |
| FIX-009 | cross-module | notifs module (`notificationRepo.createNotificationForModule` pattern, CLAUDE.md) | Admin alert / advertiser notification on auto-pause | Use existing pattern; keep minimal (the notify piece is V1 RECOMMENDED) |
| FIX-007 (strict) | product decision | Vendor-identity model (who is "the vendor user"? no vendor↔user link beyond optional `contact_person_id`) | The vendor-ownership half of the check cannot be implemented without it | Yes — implement only org-scope half now; defer ownership half |
| FIX-012 | shared/platform | `x-audit` extension generator + `core/audit/audit-action.ts` | Audit middleware is generated from TypeSpec extensions | Reuse existing pattern; regen |
| (all writes) | database/schema | Existing tables/enums: `ad_report`, `member_ad_opt_out`, `marketplace_listing/order`, `vendor_status`/`listing_status`/`order_status`/`creative_status` | Fixes WIRE existing schema; no migration required | No new migration in active scope |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Should advertising + vendor verification authority be platform admin (per m16/m17) or association admin (per current routes)? Determines route mounting (`/admin/*` vs `/association/*`), roles, and tenancy of advertiser/campaign tables. | `[NEEDS PRODUCT DECISION]` | G-06 (no FIX-ID — excluded from active scope) | Wrong trust boundary if shipped; blocks re-gating of `reviewCreative`/`verifyVendor` | Product (Elad) decides before any re-gate. Until then, current `association:admin` gating stays and is documented as interim. |
| Who is "the vendor" as an authenticated actor? Staff-mediated (current) vs vendor-portal identity. | `[NEEDS PRODUCT DECISION]` | FIX-007 (strict half) | Vendor-ownership ownership check and createListing gating depend on it | Implement org-scope half of FIX-007 now; defer vendor-ownership assertion until decided. |
| On `person.deleted`, should reviews be anonymized, deleted, or block deletion (current FK RESTRICT)? | `[NEEDS PRODUCT DECISION]` | G-13 (no FIX-ID — excluded) | Cross-module cascade will hit FK errors otherwise; spec says preserve NPS history | Product + person-module owner decide; then add reviews subscriber or documented RESTRICT policy. |
| Does `listListings` default to active-only for non-admin callers, or expose drafts? | `[NEEDS CONFIRMATION]` | FIX-003 (verify members don't see drafts) | Possible draft-listing leak to members | Engineer confirms during Batch B by reading `listListings.ts` default filter. |
| Do `GET /vendors` / `GET /listings` return cross-org data when `organizationId` is undefined, or fail? | `[NEEDS CONFIRMATION]` | FIX-001 (determines if it is also a read-isolation P0) | Decides whether FIX-001 must also add read-isolation tests | Engineer runs the list endpoints against a seeded DB during Batch A. |
| Is the memberry officer reviews route a consumer of THIS reviews module or of membership applications? | `[NEEDS CONFIRMATION]` | G-07 (deferred frontend) | Affects frontend scoping for reviews | Engineer confirms before any reviews UI work. |
| Is the marketplace/advertising group actually in the current pilot (audit index: "lower risk, later")? | `[NEEDS PRODUCT DECISION]` | sequencing of whole plan; G-07/FIX-006/FIX-007 priority | If not in pilot, UI and order completeness can be deprioritized below other modules | Product confirms sequencing before scheduling Batches B/D. |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| G-06 — Re-gate creative review / vendor verification to platform admin | `[NEEDS PRODUCT DECISION]` | Authority model (platform-admin vs association-admin) undecided; changes route mounting and tenancy | Product decision on authority model (§8 row 1) |
| G-13 — Reviews subscriber in `domain-event-consumers.ts` (or documented RESTRICT policy) | `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` | Anonymize-vs-delete-vs-block policy undecided; FK RESTRICT will fail `person.deleted` cascade | Product + person-module owner decide deletion policy (§8 row 3); coordinate with person module |
| FIX-007 strict vendor-ownership check on `fulfillOrder` | `[NEEDS PRODUCT DECISION]` | No vendor↔user link exists beyond optional `contact_person_id`; cannot assert ownership without vendor-identity model | Vendor-identity decision (§8 row 2). Org-scope half proceeds now. |
| G-07 admin vendor management screen | sequencing | V1 RECOMMENDED but consumes backend that is currently broken; building UI on a 500-ing API wastes effort | Batches A–B land (reliable backend); then build minimal admin vendor list + verify/reject screen |
| Read-isolation hardening for `GET /vendors`/`GET /listings` (if they leak cross-org) | `[NEEDS CONFIRMATION]` | Whether reads leak when `organizationId` undefined is unconfirmed; may elevate FIX-001 to a read+write P0 | Runtime confirmation against seeded DB during Batch A (§8 row 5) |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Member-facing marketplace UI (`/marketplace/...` browse/detail/apply) | §23, G-07 | `V2 DEFERRED` | m17 explicitly defers to Phase 3 |
| Payments/refunds for marketplace orders (Stripe); `confirmed`/`refunded` order states | §23, G-08 refund half, §13 | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | MODULE_SPEC.marketplace §2/§9 out of scope; refund state stays dormant |
| `ad_placement` + `ad_impression` tables, pricing models, analytics dashboards, CSV export, CPM caps/pacing, spend tracking (`spent_cents`) | §23, §13, G-09 budget half | `V2 DEFERRED` `[DO NOT OVERBUILD]` | m16 later-phase vision; V1 only needs safety rails on the thin slice |
| Creative versioning / revision flow / review-history rows | §23, §15 | `V2 DEFERRED` | m16 review-history screen deferred anyway |
| Advertiser self-service portal; advertiser suspension cascade (`is_active` enforcement) | §23, §12 | `V2 DEFERRED` | Later-phase ad-network buildout |
| Group purchasing / pricing tiers / EMR referral flows; BR-38 referral-fee disclosure UI | §23 | `V2 DEFERRED` | Phase 3 member commerce |
| `campaign_status` expansion (6 → 9 states incl. `scheduled`/`pending_creative`) | §13 P3 | `V2 DEFERRED` | Thin slice acceptable; only `auto_paused` representation needed, folded into FIX-009 design |
| `email_footer`/`event_sponsor` ad-slot naming reconciliation vs m16 formats | §6 | `[NEEDS CONFIRMATION]` | Clarify mapping only when real ad delivery is built |
| Update stale `MODULE_SPEC.marketplace.md` §9 ("Zero Hurl contract tests") doc-only line | §22 P3 | doc cleanup | Low value alone; bundle the §3 + §9 doc fixes into Batch B |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| NPS aggregation / trends inside reviews module | §9, §17, §23 | Owned by `surveys` (MODULE_SPEC.reviews §2) — would create a duplicate source of truth |
| Review editing / update endpoint | §23 | Immutability (delete-only) is a deliberate invariant |
| Behavioral-targeting or any member-level ad analytics | §23 | m16 §4 explicitly prohibits |
| New vendor-portal identity/role system | §23 | `[DO NOT OVERBUILD]` — staff-mediated entry acceptable for V1; full vendor auth is a platform-scale feature pending product decision |
| Expanding the `refunded` order state / payment integration during this pass | §6, §23 | `[DO NOT OVERBUILD]` — no payment system; dead state should not be wired now |
| Full m16 ad-network entity model (placements/impressions/pricing/pacing) | §13, §23 | `[DO NOT OVERBUILD]` — V1 needs only safety rails on the existing thin slice |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Single root cause (dropped TypeSpec namespace prefix → middleware bypass → undefined `organizationId`) manifesting across ~14 routes. Fix at pipeline/middleware level, not per-route. Confirm exact codegen mechanism (compare these .tsp files with a module that keeps its prefix) before choosing fix point. |
| FIX-002 | Root cause | The tolerant `^(201\|400\|409\|500)$` assertions are the root cause of zero regression protection; tightening them is the fix, not a patch. |
| FIX-003 | Root cause | Missing endpoint entirely — `MARKETPLACE_LISTING_VALID_TRANSITIONS` defined but no caller. Adding the activation endpoint addresses the cause, not a symptom. |
| FIX-004 | Root cause | Hardcoded target state `'verified'` is the cause; decision-based endpoint removes the limitation at source. |
| FIX-005 | Root cause | `parseFloat(listing.price ?? '0')` fallback is the direct cause of free orders. Reject/require price at source. |
| FIX-006 | Root cause | Endpoints never built; `cancelOrder` repo method dead. Adding handlers wires existing intent. |
| FIX-007 | Root cause (org half) / blocked (ownership half) | Org-scope half = root-cause fix (lookups ignore org). Vendor-ownership half blocked on identity model — do not patch a symptom. |
| FIX-008 | Root cause | Handler is a no-op + serve trusts client flag; persisting the row and reading server-side fixes both causes. |
| FIX-009 | Root cause | No insert + wrong threshold + wrong scope (campaign vs creative) + no window. Rewrite the pipeline; existing test blesses the bug and must be replaced. |
| FIX-010 | Root cause | Serve query never reads campaign state. Filtering at serve is the root fix; also a prerequisite for FIX-009's pause to have effect. |
| FIX-011 | Root cause | Missing org filter despite existing column/index. Adding filter from ctx is root-cause. |
| FIX-012 | Root cause (observability gap) | Absent `x-audit` extensions; adding them at the declaration is the canonical P1.5 fix, not a workaround. |

## 13. Recommended First Fix Batch

**Batch A — P0 core-workflow blocker + regression net.**

- **Included Fix IDs:** FIX-001 (G-01), FIX-002 (G-14).
- **Why this batch comes first:** Nothing else in the plan is verifiable while every write 500s. FIX-001 is the single P0 root cause and a shared/platform change; it must land alone with full regeneration and a full contract-suite rerun before any module-local fix can be trusted. FIX-002 is inseparable — the contract tests must be tightened in lockstep or a "fixed" module would still pass on tolerated 500s.
- **Tests to write first (RED):**
  1. Hurl: vendor/listing/order/advertiser/campaign/creative creates return 201 WITH org context and 403 WITHOUT it (replace 500-tolerant assertions) — `marketplace-flow.hurl`, `advertising-flow.hurl`.
  2. OpenAPI path snapshot asserting `/association/marketplace/*` and `/association/advertising/*` prefixes are present (regression guard against future prefix drop).
- **Explicit out-of-scope for Batch A:** all marketplace workflow endpoints (FIX-003/004/005/006/007 → Batch B); all advertising safety rails (FIX-008/009/010 → Batch C); reviews + audit (FIX-011/012 → Batch D); G-06 authority re-gate, G-13 review-deletion, strict vendor-ownership, G-07 admin UI (all blocked/deferred); everything in §11 Do Not Build and §10 Deferred. Do NOT hand-edit generated files — regenerate via `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Marketplace/Ads/Reviews
- **Exact module slug:** `marketplace-advertising`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md`
- **Exact batch to execute first:** Batch A (FIX-001 G-01 + FIX-002 G-14). Run it standalone; do not bundle Batch B/C/D into the same pass.
- **Tests to prioritize (write RED first):** (1) Hurl create-ops return 201 with org context / 403 without (tighten `marketplace-flow.hurl` + `advertising-flow.hurl`, removing the `500` tolerance); (2) OpenAPI path snapshot asserting the `/association/{marketplace,advertising}/*` prefixes. Then regenerate and rerun the FULL contract suite (not just these files) because the fix touches shared codegen.
- **Files likely to touch:** `specs/api/src/modules/marketplace.tsp` + `advertising.tsp` (namespace/`@route` nesting) OR `services/api-ts/src/app.ts` (mount `orgContextMiddleware` on these route groups); then regenerated `services/api-ts/src/generated/openapi/routes.ts` + `specs/api/dist/openapi/openapi.json` via build+generate; contract Hurl files. Decide the fix point (codegen vs middleware) after confirming WHY the prefix is dropped — compare these two .tsp files against a module that keeps its prefix.
- **Shared/database cautions:** FIX-001 is a `[SHARED DEPENDENCY]` with `[CROSS-MODULE RISK]` — the same prefix-drop symptom appears on `/postings` (job board); rerun the full contract suite and watch for regressions there. NEVER hand-edit generated files; always regenerate. No database migration is needed in any active batch — all required tables and enums already exist; fixes wire existing schema. While in Batch A, confirm whether `GET /vendors`/`GET /listings` leak cross-org data when `organizationId` is undefined (may elevate FIX-001 to a read+write P0 and require read-isolation tests).
- **Items NOT to implement (this pass and until unblocked):** G-06 authority re-gate (`[NEEDS PRODUCT DECISION]`), G-13 reviews person-deletion policy (`[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]`), the strict vendor-ownership half of FIX-007 (`[NEEDS PRODUCT DECISION]` on vendor identity — org-scope half only), G-07 admin UI (wait for Batches A–B), and everything in §10 Deferred and §11 Do Not Build (member marketplace UI, payments/refunds, ad placements/impressions/analytics/pacing/versioning, advertiser portal/suspension cascade, group purchasing, BR-38 UI, NPS aggregation in reviews, review editing, behavioral targeting, vendor-portal identity system). Do not promote any V2 DEFERRED item into this pass.

Next recommended step:
Module/group: Marketplace/Ads/Reviews
Module slug: marketplace-advertising
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md
Recommended batch: Batch A — P0 core-workflow blocker + regression net (FIX-001, FIX-002)
