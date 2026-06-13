# AHA Module/Group Fix Report: Marketplace/Ads/Reviews

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Marketplace/Ads/Reviews |
| Module slug | marketplace-advertising |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/marketplace-advertising-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | **Batch A — P0 core-workflow blocker + regression net** (FIX-001 G-01, FIX-002 G-14) |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked before implementation) |
| Working tree status checked | Yes (`git status --short` run first; pre-existing AHA changes from ~10 prior modules preserved) |
| Fix scope | P0 (FIX-001) + P1 (FIX-002), both V1 REQUIRED |
| Out of scope | All Batch B/C/D fixes; G-06 authority model, G-13 review-deletion, strict vendor-ownership half of FIX-007, G-07 admin UI; everything in §10/§11 of the fix-ready plan |
| Shared files touched | Yes — `specs/api/src/main.tsp` (shared TypeSpec service entrypoint) + regenerated `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` |
| Schema/migration touched | No — Batch F empty; all required tables/enums already exist |
| Limitations | Live Hurl contract suite NOT executed — requires a booted API on :7213 + seeded Postgres (org `ed8e3a96…`, officer `test@memberry.ph`); marked `[BLOCKED BY ENVIRONMENT]`. Fix proven deterministically via OpenAPI snapshot + generated-route assertion + 48-assertion unit regression test. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G-01 — `/association/{marketplace,advertising}` route prefix dropped → `orgContextMiddleware` never runs → `organizationId` undefined → every write 500 (D-11) | P0 | V1 REQUIRED | A | Blocks every create workflow of both sub-modules; all other fixes depend on it | **Fixed** |
| FIX-002 | G-14 — Contract tests assert `^(201\|400\|409\|500)$`, tolerating the 500s | P1 | V1 REQUIRED | A | No regression protection; a fixed module would still "pass" while broken; inseparable from FIX-001 | **Fixed** |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| OpenAPI paths for marketplace/advertising ops | All 16 ops at ROOT (`/vendors`, `/listings`, `/orders`, `/advertisers`, `/campaigns`, `/creatives`, `/placement`, `/opt-out`) — no `/association` prefix | FIX-001 | Confirmed via `specs/api/dist/openapi/openapi.json`; root paths bypass `/association/*` org-context mount |
| Generated `routes.ts` registration | All 16 ops registered at root (`app.post('/vendors', …)`, etc.) | FIX-001 | Confirmed via `services/api-ts/src/generated/openapi/routes.ts` |
| New regression test `marketplace-advertising-route-prefix.test.ts` | **RED** — 32 of 48 assertions FAIL (16 OpenAPI-prefix + 16 Hono-route assertions) for the correct reason: ops live at root, not under `/association/*` | FIX-001 | RED captured before applying the fix (see §6) |
| Hurl flow files | `marketplace-flow.hurl`, `advertising-flow.hurl`, `reviews-flow.hurl` tolerated `500` on create ops via `status toString matches "^(…\|500)$"` | FIX-002 | Tolerance encoded the broken behavior; baseline confirmed by grep |
| Other `/association/*` modules (control) | `/association/member/*`, `/association/events/*`, `/association/documents/*` retain prefix because their `MonobaseAPI` re-exports carry explicit `@route("/association/…")`; marketplace/advertising re-exports did not | FIX-001 | Root cause isolation (see §12) |
| Live Hurl suite | Not run (no server booted) | — | `[BLOCKED BY ENVIRONMENT]` |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Added explicit `@route("/association/marketplace")` to the 3 Marketplace re-export interfaces and `@route("/association/advertising")` to the 4 Advertising re-export interfaces in `MonobaseAPI` (the TypeSpec service entrypoint). Rebuilt OpenAPI (`cd specs/api && bun run build`) and regenerated routes/validators/registry (`cd services/api-ts && bun run generate`). All 16 ops now emit under `/association/{marketplace,advertising}/*`, matching the existing `app.use('/association/*', … orgContextMiddleware())` mount in `app.ts` (unchanged). | `specs/api/src/main.tsp`; regenerated `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` | `[SHARED DEPENDENCY]` `[CROSS-MODULE RISK]` | Surgical: only 7 `@route` decorators added. No hand-edit of generated files. No `app.ts` change. Jobs (`/postings`) left untouched — out of scope (separate module). |
| FIX-002 | Rewrote the 3 Hurl flow files: (a) updated all paths to the new `/association/{marketplace,advertising}/*` prefixes; (b) removed `500` from every status assertion; (c) tightened create ops to success-or-exact-4xx (e.g. createVendor `^(201\|409)$`, createCampaign `^(201\|400\|404\|422)$`); (d) refreshed stale D-11 header comments. | `specs/api/tests/contract/marketplace-flow.hurl`, `advertising-flow.hurl`, `reviews-flow.hurl` | No (test-only) | A still-broken module now fails the suite instead of passing on 500 tolerance. |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/handlers/__tests__/marketplace-advertising-route-prefix.test.ts` (NEW, 48 assertions) | data/schema + regression | All 16 marketplace/advertising ops are emitted in the OpenAPI spec AND registered in generated `routes.ts` under `/association/{marketplace,advertising}/*` (inside the org-context middleware boundary), and that none leak back to a root path. Deterministic, no DB/server. The durable regression net that goes RED if the prefix is ever dropped again. | FIX-001 |
| `specs/api/tests/contract/marketplace-flow.hurl` (UPDATED) | integration (Hurl) | Marketplace ops reachable at prefixed paths; create ops return 201/exact-4xx, never 500 | FIX-001, FIX-002 |
| `specs/api/tests/contract/advertising-flow.hurl` (UPDATED) | integration (Hurl) | Advertising ops reachable at prefixed paths; create ops return 201/exact-4xx, never 500 | FIX-001, FIX-002 |
| `specs/api/tests/contract/reviews-flow.hurl` (UPDATED) | integration (Hurl) | Removed unjustified 500 tolerance on createReview (reviews is the healthy sub-module; paths unchanged) | FIX-002 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/__tests__/marketplace-advertising-route-prefix.test.ts` (BEFORE fix) | **Failed (RED, expected)** | 32/48 assertions failed for the correct reason (ops at root, not `/association/*`). Baseline captured. |
| `cd specs/api && bun run build` | Passed | OpenAPI rebuilt; only pre-existing `implicitOptionality` deprecation warnings (unrelated). Verified all 16 ops now under `/association/*` and zero root leaks. |
| `cd services/api-ts && bun run generate` | Passed | Regenerated routes/validators/registry; 0 new handler stubs (no handler changes needed). |
| `bun test src/handlers/__tests__/marketplace-advertising-route-prefix.test.ts` (AFTER fix) | **Passed** | 48 pass / 0 fail. |
| `bun test src/handlers/marketplace/ src/handlers/advertising/ src/handlers/reviews/ src/handlers/__tests__/marketplace-advertising-route-prefix.test.ts` | **Passed** | 179 pass / 0 fail across 16 files (all module unit tests + regression). |
| `cd services/api-ts && bun run typecheck` (`tsc --noEmit`) | **Passed** | Clean; regenerated files + new test compile with no errors. |
| Live Hurl contract suite (`bun run test:contract` against :7213) | **Blocked** | `[BLOCKED BY ENVIRONMENT]` — runner does not boot the impl; needs a running API + seeded Postgres. Hurl files statically verified instead. |

## 7. Validation Summary

- **Passed:** OpenAPI rebuild, route regeneration, the new 48-assertion route-prefix regression test (RED→GREEN proven), all 179 marketplace/advertising/reviews module unit tests, and `tsc --noEmit` typecheck of the api-ts workspace.
- **Failed:** None after the fix. (The pre-fix RED of the regression test was intentional and expected.)
- **Not run:** Whole-repo test suite (intentionally out of scope per the focused-validation instruction).
- **Blocked:** Live Hurl execution (`[BLOCKED BY ENVIRONMENT]` — no booted server + seeded DB). The fix is nonetheless proven: the OpenAPI spec, the generated Hono routes, and the unit regression test all confirm the 16 ops now resolve under `/association/*`, and `org-context.ts` documents fail-closed 403 (not 500) when org context is absent — directly resolving D-11.
- **Pre-existing/unrelated:** The 821 TypeSpec build warnings are pre-existing `implicitOptionality` deprecations across many modules, unrelated to this fix. The regenerated diff additionally surfaces prior-module additive ops (`closeElectionVoting` route/validator, `SearchDocumentsQuery` validator) that were already in the working tree from earlier AHA passes — preserved, not reverted.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| TypeSpec service entrypoint | `specs/api/src/main.tsp` (`MonobaseAPI` namespace, Wave G3 block) | Every module's OpenAPI emission flows through this file; change was additive (7 `@route` decorators) and isolated to the marketplace/advertising re-exports | New route-prefix unit test + OpenAPI snapshot assertion | `[SHARED DEPENDENCY]` — verified the diff touches ONLY the 16 target ops; no other module's paths changed (confirmed: zero non-target `app.<verb>` path lines changed in routes.ts) |
| Generated route registry | `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` | Hono app route table; consumed by `registerOpenAPIRoutes` in `app.ts` | Regression test asserts on routes.ts text directly | Regenerated, never hand-edited. Larger line-delta is positional reordering (routes are path-sorted; 16 ops moved from root to `/association/*`). No validators/registry entries dropped for other modules. |
| Org-context middleware boundary | `services/api-ts/src/app.ts` `app.use('/association/*', … orgContextMiddleware())` | The mount that now catches the relocated routes | n/a (unchanged) | NOT modified by this pass. The fix deliberately routes the ops under the existing `/association/*` mount. `org-context.ts` fails closed with 403, resolving D-11's 500. |
| Same prefix-drop class on other groups | Jobs module (`JobsJobPostingManagement`/`JobsJobApplicationManagement` re-exports in `main.tsp`) emit `/postings` at root with the identical missing-`@route` defect | `[CROSS-MODULE RISK]` — same root cause, but Jobs is a separate module **out of Batch A scope** | Not covered (out of scope) | Documented as a remaining gap (§9). The marketplace-advertising regression test does NOT assert on jobs. Recommended as a follow-up `04` pass for the jobs module. |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Jobs module (`/postings`) has the identical dropped-prefix defect (missing `@route` on its `main.tsp` re-exports) | Cross-module sibling of G-01 | Jobs is a separate module, out of Batch A (marketplace-advertising) scope | Run a `04` pass for the jobs module applying the same `@route("/association/jobs")` fix + regression test |
| Live Hurl contract-suite execution | FIX-001/FIX-002 | No booted API + seeded Postgres available in this environment | Rerun `bun run test:contract` against a booted, seeded API to confirm end-to-end 201/403 statuses |
| Cross-org read-isolation confirmation for `GET /vendors`/`GET /listings` when `organizationId` undefined | `[NEEDS CONFIRMATION]` (fix-ready §8 row 5) | Requires runtime against a seeded DB; now that reads are under `/association/*` they hit fail-closed org-context, so the undefined-org leak path is closed at the middleware — but not runtime-verified | Verify against seeded DB; the `/association/*` relocation already routes reads through `orgContextMiddleware` |
| All Batch B/C/D fixes (G-04, G-05, G-11, G-08, G-10, G-02, G-03, G-09, G-12, G-12 audit) | FIX-003…FIX-012 | Out of scope — later batches | Run subsequent `04` passes per the fix-ready plan's batch order |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| G-06 — Re-gate creative review / vendor verification to platform admin | `[NEEDS PRODUCT DECISION]` | Authority model (platform-admin vs association-admin) undecided | Product decision on authority model |
| G-13 — Reviews subscriber for `person.deleted` (anonymize vs delete vs block) | `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` | Deletion policy undecided; FK RESTRICT will fail cascade | Product + person-module owner decide |
| FIX-007 strict vendor-ownership check on `fulfillOrder` | `[NEEDS PRODUCT DECISION]` | No vendor↔user link beyond optional `contact_person_id` | Vendor-identity decision (org-scope half is a future Batch B item) |
| G-07 admin vendor management UI | sequencing | Consumes backend that is only now reliable | Land Batches A–B, then build minimal admin screen |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Marketplace workflow completion (listing activation, vendor reject/suspend, price guard, order list/cancel, order org-scoping) | (Batch B) | Out of selected batch — later `04` pass |
| Advertising safety rails (persist+enforce opt-out, real ad-report pipeline, campaign-state serve gating) | (Batch C) | Out of selected batch — later `04` pass |
| Reviews org-scoping + `x-audit` extensions | (Batch D) | Out of selected batch — later `04` pass |
| Member marketplace UI, payments/refunds, ad placements/impressions/analytics/pacing/versioning, advertiser portal, group purchasing, BR-38 UI, NPS aggregation in reviews, review editing, behavioral targeting, vendor-portal identity | `V2 DEFERRED` / `DO NOT ADD` / `[DO NOT OVERBUILD]` | Excluded by fix-ready plan §10/§11 |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `specs/api/src/main.tsp` | Added `@route("/association/marketplace")` to 3 Marketplace re-exports and `@route("/association/advertising")` to 4 Advertising re-exports in `MonobaseAPI`; updated the Wave G3 comment to document the root cause | FIX-001 |
| `services/api-ts/src/generated/openapi/routes.ts` | Regenerated — 16 ops moved from root to `/association/{marketplace,advertising}/*` | FIX-001 (generated) |
| `services/api-ts/src/generated/openapi/validators.ts` | Regenerated (consistency with new paths) | FIX-001 (generated) |
| `services/api-ts/src/generated/openapi/registry.ts` | Regenerated (consistency) | FIX-001 (generated) |
| `services/api-ts/src/handlers/__tests__/marketplace-advertising-route-prefix.test.ts` | NEW 48-assertion regression test (OpenAPI + routes.ts prefix invariant + no-root-leak) | FIX-001 |
| `specs/api/tests/contract/marketplace-flow.hurl` | Paths → `/association/marketplace/*`; removed 500 tolerance; tightened assertions; refreshed header | FIX-001, FIX-002 |
| `specs/api/tests/contract/advertising-flow.hurl` | Paths → `/association/advertising/*`; removed 500 tolerance; tightened assertions; refreshed header | FIX-001, FIX-002 |
| `specs/api/tests/contract/reviews-flow.hurl` | Removed unjustified 500 tolerance on createReview (paths unchanged) | FIX-002 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| OpenAPI now emits all 16 ops under `/association/{marketplace,advertising}/*`; zero root leaks | `specs/api/dist/openapi/openapi.json` (verified via path inspection) | FIX-001 |
| Generated routes register all 16 ops under the prefix; no root registrations | `services/api-ts/src/generated/openapi/routes.ts` (lines 282–326, 664–721) | FIX-001 |
| RED→GREEN of the route-prefix regression test (32 fail → 48 pass) | Test-run notes in §3/§6 of this report | FIX-001 |
| `tsc --noEmit` clean; 179 module unit tests pass | Test-run notes in §6 | FIX-001, FIX-002 |
| `org-context.ts` documents fail-closed 403 (not 500) when org context absent | `services/api-ts/src/middleware/org-context.ts` (lines 8, 107, 137) | FIX-001 |

## 14. Completion Decision

**COMPLETE**

Batch A (FIX-001 G-01 + FIX-002 G-14) is fully implemented and validated within the focused scope. The single root cause — marketplace/advertising interface re-exports in `main.tsp` missing the `@route("/association/…")` prefix that every other module carries — was identified, fixed surgically (7 decorators, regen-only for generated files, no `app.ts` change), and proven by: a RED→GREEN 48-assertion regression test, the OpenAPI spec, the generated route table, a clean typecheck, and 179 passing module unit tests. The three contract Hurl files were updated (prefixed paths + 500 tolerance removed). Live Hurl execution is the only validation left, blocked solely by the absence of a booted+seeded server (`[BLOCKED BY ENVIRONMENT]`), and is not required to establish the fix given the deterministic proofs above. Prior modules' working-tree changes were preserved; no destructive git commands used; nothing committed.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for the **next batch of this module** — **Batch B (Marketplace workflow completion: FIX-003 listing activation, FIX-004 vendor reject/suspend, FIX-005 price guard, FIX-006 listOrders/cancelOrder, FIX-007 order org-scoping)** — now that org context is reliably present.

```txt
Module/group: Marketplace/Ads/Reviews
Module slug: marketplace-advertising
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md
Recommended batch: Batch B — Marketplace workflow completion (FIX-003, FIX-004, FIX-005, FIX-006, FIX-007 org-scope half)
```

Also recommended (separate, independent): a `04` pass on the **jobs module** to apply the identical `@route("/association/jobs")` prefix fix (`/postings` has the same dropped-prefix defect surfaced here as a cross-module risk), and a live `bun run test:contract` run against a booted+seeded API to confirm end-to-end statuses for this batch.

---

# Batch B — Marketplace workflow completion (appended 2026-06-12)

> Appended section. Batch A (above, §1–§15) is unchanged. This documents the
> **Batch B** pass: FIX-003 (listing activation), FIX-004 (vendor reject/suspend),
> FIX-005 (null-price guard), FIX-006 (order list/get/cancel + wire dead
> `cancelOrder`), FIX-007 (order/listing org-scope half). G-06 authority re-gate
> and FIX-007's strict vendor-ownership half remain BLOCKED (product decision).

## B1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Marketplace/Ads/Reviews |
| Module slug | marketplace-advertising |
| Fix date | 2026-06-12 |
| Batch executed | **Batch B — Marketplace workflow completion** (FIX-003, FIX-004, FIX-005, FIX-006, FIX-007 org-scope half) |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked; RED-first per fix) |
| Working tree status checked | Yes (`git status --short`; pre-existing AHA dirty tree across ~290 files preserved — incl. Batch A's `main.tsp`, and prior membership-lifecycle changes to `core/domain-events.registry.ts` + `member/membership/utils/status-transitions.ts` which were NOT touched this pass) |
| Fix scope | P1 (FIX-003, FIX-004) + selected P2 (FIX-005, FIX-006, FIX-007 org-scope) — V1 REQUIRED + selected V1 RECOMMENDED |
| Out of scope | G-06 authority re-gate, FIX-007 vendor-ownership half (both `[NEEDS PRODUCT DECISION]`); Batch C (advertising), Batch D (reviews/x-audit), jobs `/postings`, everything in fix-ready §10/§11 |
| Shared files touched | Yes — `specs/api/src/modules/marketplace.tsp` (module TypeSpec) + regenerated `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` and `packages/sdk-ts/src/generated/*` (additive new operationIds; NOT hand-edited) |
| Schema/migration touched | No — all enums/tables already exist; fixes wire existing schema |
| Limitations | None blocking. Live Hurl contract suite **DID run** this pass (env booted) — see B6. Finer per-actor order ownership (buyer-only-own, vendor↔user) deferred to the G-06 authority model. |

## B2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-003 | G-04 — No endpoint moved a listing `draft → active`; member buy flow dead-ended (createOrder is active-only) | P1 | V1 REQUIRED | B | Purchase flow unreachable end-to-end without it | **Fixed** |
| FIX-004 | G-05 — `verifyVendor` hardcoded `'verified'`; reject/suspend unreachable (approve-only theater) | P1 | V1 REQUIRED | B | Admin cannot reject bad vendors / suspend verified ones | **Fixed** |
| FIX-005 | G-11 — `createOrder` treated null listing price as 0 → silent free orders | P2 | V1 RECOMMENDED | B | Data-integrity guard; one-line root-cause fix | **Fixed** |
| FIX-006 | G-08 — No listOrders/getOrder/cancel endpoints; `OrderRepository.cancelOrder` dead | P2 | V1 RECOMMENDED | B | Vendors couldn't discover orders to fulfil; buyers couldn't cancel | **Fixed** |
| FIX-007 (org-scope half) | G-10 — `createOrder`/`fulfillOrder` lookups had no org scoping → cross-org manipulation | P2 | V1 RECOMMENDED | B | Org-isolation is the in-scope, root-cause half | **Fixed** |
| FIX-007 (vendor-ownership half) | G-10 strict — assert the fulfiller owns the vendor | P2 | — | B | No vendor↔user link beyond optional `contact_person_id` | **Blocked** `[NEEDS PRODUCT DECISION]` |

## B3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `verifyVendor.test.ts` decision-based assertions (NEW) | **RED** — 4 fail: a `decision: rejected`/`suspended` request still resolved to `verified`; invalid transition + unknown decision did not throw | FIX-004 | Confirmed the handler ignored the requested transition (hardcoded `'verified'`) |
| `listing-order.test.ts` null-price + org-scope assertions (NEW) | **RED** — 3 fail: null-price listing yielded a ₱0 order (resolved, not rejected); cross-org listing/order resolved instead of 404 | FIX-005, FIX-007 | Confirmed the ₱0 fallback and missing org scoping |
| `updateListing.test.ts` (NEW file, stub handler) | **RED** — 8 fail (stub threw `not implemented`) | FIX-003 | No activation endpoint existed |
| `order-discovery.test.ts` (NEW file, stub handlers) | **RED** — 14 fail (stubs threw `not implemented`) | FIX-006 | No listOrders/getOrder/cancelOrder existed; `cancelOrder` repo method was dead |
| Full api-ts `bun test` (carried from A8b) | 6120 pass / 1 fail / 4 todo (the 1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`) | — | Baseline before Batch B |
| Live marketplace Hurl flow | Batch A's synthetic-id version passed (15 req) | — | Re-confirmed bootable before extending to the real journey |

## B4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-003 | New `PATCH /association/marketplace/listings/{listingId}` `updateListing` op (TypeSpec-first) + handler. Drives `MARKETPLACE_LISTING_VALID_TRANSITIONS` (draft→active→archived) via `assertValidTransition`; org-scoped lookup; edits title/description/price/currency/categoryTags; rejects empty title/desc and no-op bodies. | `marketplace.tsp` (op + `UpdateMarketplaceListingRequest`), new `handlers/marketplace/updateListing.ts` | regen only (`[SHARED DEPENDENCY]` additive) | Activation is what makes a listing buyable |
| FIX-004 | `verifyVendor` made **decision-based**: optional `decision` body (`verified`/`rejected`/`suspended`, default `verified`); validates the value (400), asserts the transition (409), dispatches to repo `verifyVendor`/`rejectVendor`/`suspendVendor`. Added `rejectVendor` (pending→rejected) to `vendor.repo.ts`. | `marketplace.tsp` (`VerifyVendorRequest` + `VendorVerificationDecision` + body on op), `handlers/marketplace/verifyVendor.ts`, `repos/vendor.repo.ts`, `MODULE_SPEC.marketplace.md` §3/§9 | regen only | Reject/suspend now reachable; approve path backward-compatible (empty `{}` body → verified) |
| FIX-005 | `createOrder` rejects a null/empty-price listing with `BusinessLogicError` instead of `parseFloat(price ?? '0')` → ₱0; also guards `NaN`. | `handlers/marketplace/createOrder.ts` | No | Root-cause fix at the source of free orders |
| FIX-006 | New `listOrders` (GET, org-scoped + buyer/vendor/status filters), `getOrder` (GET, org-scoped), `cancelOrder` (POST, FSM-guarded pending/confirmed→cancelled) — all TypeSpec-first. `cancelOrder` handler **wires the previously-dead `OrderRepository.cancelOrder`**. | `marketplace.tsp` (3 ops + `OrderListResponse`), new `handlers/marketplace/{listOrders,getOrder,cancelOrder}.ts` | regen only | Order discovery + buyer cancellation now exist |
| FIX-007 (org-scope) | `createOrder` (listing lookup), `fulfillOrder` (order lookup), plus the new `getOrder`/`cancelOrder`/`updateListing` all reject a cross-org id as 404 (`record.organizationId !== ctx organizationId`). | `handlers/marketplace/createOrder.ts`, `fulfillOrder.ts` (+ the 3 new handlers) | No | Prevents cross-org order/listing manipulation |
| docs | Refreshed stale `MODULE_SPEC.marketplace.md` (§3 handler inventory incl. decision-based verify + 4 new ops, §7 test coverage, §9 "Zero Hurl" gotcha now obsolete) and the stale `marketplace.tsp` header endpoint list / "mounting deferred" note. | `MODULE_SPEC.marketplace.md`, `marketplace.tsp` header | No | Fix-ready plan §2/§10 doc cleanup |

## B5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `handlers/marketplace/verifyVendor.test.ts` (UPDATED, +6 tests) | backend/unit | Decision-based review: pending→rejected, verified→suspended, explicit & default verified, invalid transition → 409, unknown decision → 400 | FIX-004 |
| `handlers/marketplace/listing-order.test.ts` (UPDATED, +3 tests) | backend/unit | Null-price listing → BusinessLogicError; cross-org listing/order → NotFoundError | FIX-005, FIX-007 |
| `handlers/marketplace/updateListing.test.ts` (NEW, 8 tests) | backend/unit | Activate draft→active, archive active→archived, invalid draft→archived → 409, missing/cross-org → 404, field edit, empty-body → 400 | FIX-003 |
| `handlers/marketplace/order-discovery.test.ts` (NEW, 14 tests) | backend/unit | listOrders org-scoped + filters; getOrder org-scoped + 404; cancelOrder pending/confirmed→cancelled, fulfilled/terminal → 409, missing/cross-org → 404 | FIX-006, FIX-007 |
| `specs/api/tests/contract/marketplace-flow.hurl` (REWRITTEN) | integration (Hurl) | Full real captured journey: create vendor → verify(decision) → create listing → activate → order(×2) → get/list → fulfil → cancel; plus FSM 409 negatives (draft→archived, cancel-fulfilled, re-cancel) and synthetic-id 404/4xx negatives. Exact statuses, no 500 tolerance. | FIX-003..007 |

## B6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test verifyVendor.test.ts` (before fix) | **Failed (RED)** | 4/13 fail for the right reason (decision ignored) |
| `bun test verifyVendor.test.ts` (after fix) | **Passed** | 13 pass / 0 fail |
| `bun test listing-order.test.ts` (before/after) | **RED → Passed** | 3 fail → 23 pass / 0 fail |
| `bun test updateListing.test.ts` (before/after) | **RED → Passed** | 8 fail (stub) → 8 pass / 0 fail |
| `bun test order-discovery.test.ts` (before/after) | **RED → Passed** | 14 fail (stubs) → 14 pass / 0 fail |
| `cd specs/api && bun run build` | **Passed** | OpenAPI rebuilt; 4 new ops + verify body emitted under `/association/marketplace/*` (only pre-existing `implicitOptionality` deprecation warnings) |
| `cd services/api-ts && bun run generate` | **Passed** | Regenerated routes/validators/registry; "0 new handler stubs, skipped 461 existing" (my 4 handlers picked up). `db:generate` pre-existing skip (duplicate-index issue, tracked separately) — no schema change here |
| `cd packages/sdk-ts && bun run generate` | **Passed** | SDK regenerated; new ops present in `sdk.gen.ts` (transformer warnings are pre-existing billing/booking schemas) |
| `bun test src/handlers/marketplace/ src/handlers/advertising/ src/handlers/reviews/ + route-prefix + status-transitions` | **Passed** | 294 pass / 0 fail across 19 files |
| `bun test` (full api-ts) | **Passed (1 pre-existing fail)** | **6151 pass / 1 fail / 4 todo** — +31 vs the 6120 baseline (exactly the new tests); the 1 fail is the SAME pre-existing unrelated `registerEmailJobs` interval-default test |
| `bun run typecheck` (api-ts) | **Passed** | `tsc --noEmit` clean |
| `bun run --filter '*' typecheck` (monorepo) | **Passed** | 5/5 workspaces exit 0 (memberry, admin, sdk-ts, ui, api-ts) — SDK regen consumers clean |
| Live marketplace journey: `hurl --test marketplace-flow.hurl` vs booted+seeded API (:7299) | **Passed** | **25 requests, 100%** — full create→verify→activate→order→fulfil/cancel journey + FSM negatives |
| Full Hurl suite: `API_URL=:7299 bun run test:contract` | **Partially Passed** | **152 / 155 files pass.** The 3 failures are all NON-marketplace, pre-existing, unrelated: `impersonation-flow.hurl`, `member/governance/position-crud.hurl`, `platformadmin-extended-flow.hurl` (/admin/committees 200-vs-403). marketplace/advertising/reviews flows all green (re-confirmed standalone: 38 req / 100%). |

## B7. Validation Summary

- **Passed:** all 5 fixes RED→GREEN at unit level (31 new tests); OpenAPI build; api-ts + SDK regen; 294 module unit tests; full api-ts suite (6151 pass, +31, no new failures); monorepo typecheck (5/5); and — unlike Batch A — the **live Hurl contract journey** (25 req, 100%) plus marketplace+advertising standalone (38 req, 100%).
- **Failed:** None attributable to Batch B. The single api-ts unit fail (`registerEmailJobs`) is the documented pre-existing/unrelated baseline failure.
- **Pre-existing/unrelated:** 3 non-marketplace contract files fail (impersonation, governance position-crud, platformadmin committees authority drift) — these live in other modules, were not touched by Batch B (which only added marketplace ops additively), and are separate audit concerns. Recorded, not fixed (out of module scope).
- **Blocked:** FIX-007 strict vendor-ownership half (`[NEEDS PRODUCT DECISION]` — no vendor↔user identity) and G-06 authority re-gate (`[NEEDS PRODUCT DECISION]`). Org-scope half shipped; finer per-actor ownership documented as dependent on the authority model.

## B8. Shared / Cross-Module / Database Impact

| Area | Files / Components | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Module TypeSpec | `specs/api/src/modules/marketplace.tsp` | Only the Marketplace tag's ops; additive (4 new ops + verify body) | OpenAPI emission verified; full Hurl journey green | `[SHARED DEPENDENCY]` additive — no other module's paths changed |
| Generated registry/routes/validators | `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` | Hono route table | Live contract suite (152/155, no marketplace regressions) | Regenerated, never hand-edited |
| SDK | `packages/sdk-ts/src/generated/*` | Frontends (memberry/admin) — no consumer of the new ops yet (marketplace UI is V2 deferred) | Monorepo typecheck 5/5 | New operationIds added; **`check:sdk-compat` will diverge further by design — NOT `--update`d** (per milestone Step 6) |
| `utils/status-transitions.ts` | (read-only reuse) | Shared transition maps | Existing `status-transitions.test.ts` green | Reused `MARKETPLACE_{LISTING,VENDOR,ORDER}_VALID_TRANSITIONS` as-is; no edit |

## B9. Remaining Gaps

| Gap | Source | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| FIX-007 strict vendor-ownership on `fulfillOrder`/`cancelOrder` | G-10 strict | No vendor↔user link | Resolve vendor-identity product decision, then assert ownership |
| Per-actor order visibility (buyer sees only own; vendor sees own vendor's) on `listOrders`/`getOrder`/`cancelOrder` | G-06 authority model | Authority model undecided; current module convention is org-scope only (no officer gate) | Decide authority model, then layer caller-scoping over the org-scope |
| 3 pre-existing non-marketplace contract failures | (other modules) | Out of scope (platformadmin/governance/impersonation) | Address in those modules' own `04` passes |
| Jobs `/postings` dropped-prefix defect | cross-module sibling of G-01 | Separate module/pass | Run a `04` pass for jobs with the same `@route` fix |

## B10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-007 strict vendor-ownership check | `[NEEDS PRODUCT DECISION]` | No vendor↔user link beyond optional `contact_person_id` | Vendor-identity decision |
| G-06 — re-gate verify/activate to platform-admin authority | `[NEEDS PRODUCT DECISION]` | Authority model (platform-admin vs association-admin) undecided | Product decision on authority model |

## B11. Deferred / Not Implemented (this pass)

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| `confirm` order transition (pending→confirmed) | `V2 DEFERRED` | Not in the selected subset; buyer-cancel + vendor-fulfil journey complete without it |
| Activation-time price requirement | `[DO NOT OVERBUILD]` | FIX-005 guards at order time (the documented fix); a price-less listing simply can't be ordered |
| Batch C (advertising), Batch D (reviews + x-audit), jobs `/postings` | (later passes) | Out of selected batch |

## B12. Files Changed (Batch B)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `specs/api/src/modules/marketplace.tsp` | +`VendorVerificationDecision`, `VerifyVendorRequest`, `UpdateMarketplaceListingRequest`, `OrderListResponse`; verify op gains `@body`; +`updateListing`/`listOrders`/`getOrder`/`cancelOrder` ops; refreshed header | FIX-003/004/006 |
| `services/api-ts/src/handlers/marketplace/verifyVendor.ts` | Decision-based review (verified/rejected/suspended, default verified) | FIX-004 |
| `services/api-ts/src/handlers/marketplace/repos/vendor.repo.ts` | +`rejectVendor` (pending→rejected) | FIX-004 |
| `services/api-ts/src/handlers/marketplace/createOrder.ts` | Org-scope listing lookup + null/NaN-price guard | FIX-005, FIX-007 |
| `services/api-ts/src/handlers/marketplace/fulfillOrder.ts` | Org-scope order lookup | FIX-007 |
| `services/api-ts/src/handlers/marketplace/updateListing.ts` | NEW — listing field update + lifecycle transition | FIX-003 |
| `services/api-ts/src/handlers/marketplace/listOrders.ts` | NEW — org-scoped order list | FIX-006 |
| `services/api-ts/src/handlers/marketplace/getOrder.ts` | NEW — org-scoped order fetch | FIX-006, FIX-007 |
| `services/api-ts/src/handlers/marketplace/cancelOrder.ts` | NEW — cancel + wire dead `cancelOrder` repo method | FIX-006 |
| `services/api-ts/src/handlers/marketplace/verifyVendor.test.ts` | +6 decision-based tests | FIX-004 |
| `services/api-ts/src/handlers/marketplace/listing-order.test.ts` | +3 null-price/org-scope tests | FIX-005, FIX-007 |
| `services/api-ts/src/handlers/marketplace/updateListing.test.ts` | NEW — 8 tests | FIX-003 |
| `services/api-ts/src/handlers/marketplace/order-discovery.test.ts` | NEW — 14 tests | FIX-006 |
| `specs/api/tests/contract/marketplace-flow.hurl` | Rewritten to the full real captured journey + FSM negatives | FIX-003..007 |
| `docs/product/MODULE_SPEC.marketplace.md` | §3/§7/§9 refreshed | docs |
| `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` | Regenerated (additive new ops) | (generated) |
| `packages/sdk-ts/src/generated/*` + `specs/api/dist/openapi/openapi.json` | Regenerated from spec | (generated) |

## B13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED→GREEN per fix (4+3+8+14 RED → all GREEN) | §B3/§B6 test-run notes | FIX-003..007 |
| Full api-ts suite 6151 pass (+31, 1 pre-existing fail) | §B6 | all |
| Monorepo typecheck 5/5 | §B6 | all |
| Live full marketplace journey — 25 req / 100% | `specs/api/tests/contract/marketplace-flow.hurl` run vs :7299 | FIX-003..007 |
| Full contract suite 152/155 (3 unrelated pre-existing) | §B6/§B7 | all |
| New ops emitted under `/association/marketplace/*` | `specs/api/dist/openapi/openapi.json`, `generated/openapi/routes.ts` | FIX-003/006 |

## B14. Completion Decision

**COMPLETE**

All five selected Batch B fixes (FIX-003, FIX-004, FIX-005, FIX-006, FIX-007 org-scope half) are implemented test-first (RED watched per fix), regenerated through the TypeSpec→OpenAPI→routes/validators/registry→SDK pipeline (no generated file hand-edited), and validated at three levels: 31 new unit tests (all GREEN; full api-ts suite 6151 pass with only the pre-existing unrelated `registerEmailJobs` fail), a clean 5/5 monorepo typecheck, and — going beyond Batch A — a **live Hurl contract run** proving the real create→verify→activate→order→fulfil/cancel journey end-to-end (25 req, 100%) with FSM 409 negatives. The two explicitly-excluded items (FIX-007 vendor-ownership half, G-06 authority re-gate) remain BLOCKED on product decisions and were not touched. The 3 full-suite contract failures are pre-existing, in other modules, and unrelated to this batch. Working tree preserved; nothing committed.

## B15. Recommended Next Step

The next decision-free `04` pass per the remaining-work sequence (A10–A13), or — staying in this module — **Batch C (advertising safety rails: FIX-008 opt-out persist, FIX-009 ad-report pipeline, FIX-010 campaign serve-gating)**, whose existing `setMemberOptOut.test.ts`/`reportAd.test.ts` bless broken behavior and must be flipped RED-first.

```txt
Module/group: Marketplace/Ads/Reviews
Module slug: marketplace-advertising
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md
Recommended batch: Batch C — Advertising safety rails (FIX-008, FIX-009, FIX-010)
```

Also still open (independent): the **jobs `/postings`** dropped-prefix `04` pass (cross-module sibling of G-01), and resolving the G-06 authority model / vendor-identity product decisions that unblock FIX-007's vendor-ownership half.

---

# Batch C — Advertising safety rails (appended 2026-06-12)

> Appended section. Batch A (§1–§15) and Batch B (§B1–§B15) above are unchanged.
> This documents the **Batch C** pass: FIX-008 (opt-out persist + server-side
> enforce), FIX-009 (real ad-report pipeline: persist + 3-in-7-days +
> creative-level auto-pause + admin notify), FIX-010 (campaign status/schedule
> serve gating). Handler+repo logic only — **no TypeSpec change, no regen, no
> migration**.

## C1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Marketplace/Ads/Reviews |
| Module slug | marketplace-advertising |
| Raw gap plan used | `docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md` (G-02, G-03, G-09) |
| Fix-ready plan used | `docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md` (§2 Batch C, §3 FIX-008/009/010) |
| Output fix report | `docs/aha/module-fix-plans/marketplace-advertising-fix-report.md` (this file) |
| Fix date | 2026-06-12 |
| Batch executed | **Batch C — Advertising safety rails** (FIX-008 G-02, FIX-009 G-03, FIX-010 G-09) |
| Superpowers used | Yes — `superpowers:test-driven-development` (RED-first per fix); plus an adversarial 2-lens review workflow over the diff (correctness + spec lenses, each finding independently verified) |
| Working tree status checked | Yes (`git status`; pre-existing AHA dirty tree preserved — incl. prior membership-lifecycle changes to `core/domain-events.registry.ts` + `member/membership/utils/status-transitions.ts` which were NOT touched) |
| Fix scope | P1 (FIX-008, FIX-009 persist+threshold+window), P1 (FIX-010 status+date window); V1 REQUIRED + selected V1 RECOMMENDED (admin notify) |
| Out of scope | Budget/pacing/spend (`spent_cents`, CPM) `V2 DEFERRED`; Batch D (reviews G-12 + x-audit); G-06 authority re-gate; jobs `/postings`; everything in fix-ready §10/§11 |
| Shared files touched | Yes — cross-module call into notifs (`NotificationRepository.createNotificationForModule`, existing pattern) for the FIX-009 admin alert |
| Schema/migration touched | No — reused existing `member_ad_opt_out`, `ad_report`, `ad_campaign.status/starts_at/ends_at` columns. No migration. |
| Limitations | `reviewCreative` has a pre-existing, out-of-scope validator(`approved`)-vs-handler(`decision`) mismatch that blocks live creative approval, so the live Hurl proves opt-out enforcement + report persistence/count; the approved→pending creative-level auto-pause and campaign serve-gating are proven deterministically by unit tests (mocked creative status / campaign dates). |

## C2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-008 | G-02 — `setMemberOptOut` persisted nothing; `getAdForPlacement` trusted a client `optedOut` query flag | P1 | V1 REQUIRED | C | Misleading success on a privacy preference; AC-M16-004 violated; trivially bypassable | Fixed |
| FIX-009 | G-03 — `reportAd` never inserted; threshold 5 (spec 3); no 7-day window; paused campaign not creative; no alert | P1 | V1 REQUIRED (persist+threshold+window); V1 RECOMMENDED (admin notify) | C | Spec-mandated member-safety mechanism did not work at all | Fixed |
| FIX-010 | G-09 — `getAdForPlacement` ignored campaign status/schedule; paused/expired/draft campaigns still served | P1 | V1 REQUIRED (status+date window; budget pacing deferred) | C | Without it FIX-009's auto-pause has no effect; violates M16-R6 | Fixed |
| (hardening) | Cross-org abuse + defense-in-depth org-scoping surfaced by adversarial review of the touched handlers | P1 | V1 REQUIRED | C | `reportAd` could report another org's creative (poison its moderation); `findByIds` lacked an explicit org filter | Fixed |

## C3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `setMemberOptOut.test.ts` (old) | GREEN but blessed a no-op (returned success without persisting; used handler-internal `optOut` not contract `optedOut`) | FIX-008 | Rewritten RED-first |
| `reportAd.test.ts` (old) | GREEN but blessed broken behavior (threshold 5, campaign-level pause, no persistence) | FIX-009 | Rewritten RED-first |
| `getAdForPlacement.test.ts` (old) | GREEN, served any approved creative regardless of campaign state; honored client opt-out flag | FIX-008/010 | Extended/rewritten RED-first |
| Full api-ts `bun test` (carried from Batch B) | 6151 pass / 1 fail / 4 todo (the 1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`) | — | Baseline before Batch C |
| Live advertising Hurl | Batch A/B synthetic-id version passed | — | Re-confirmed bootable before extending to real journeys |

## C4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-008 | `setMemberOptOut` persists/deletes a `member_ad_opt_out` row (idempotent), reads contract field `optedOut`, fails closed without org context. `getAdForPlacement` reads opt-out **server-side** and ignores the client `optedOut` query flag. | `setMemberOptOut.ts`, `getAdForPlacement.ts`, new `repos/optOut.repo.ts` | No | New `MemberAdOptOutRepository` (isOptedOut/optOut/optIn) |
| FIX-009 | `reportAd` persists each `ad_report` row, counts within a rolling 7-day window, auto-pauses the **creative** at threshold **3** (reverts to `pending` for re-review — `creative_status` enum has no `paused`), and notifies the creative owner (fire-and-forget). | `reportAd.ts`, `repos/creative.repo.ts` (createReport, countReportsWithinDays, pauseCreative) | `[CROSS-MODULE RISK]` — calls notifs `createNotificationForModule` (existing pattern, type `system`, in-app) | Campaign is NOT paused |
| FIX-010 | `getAdForPlacement` gates serving on parent campaign `status === 'active'` and now within `starts_at..ends_at` (null bounds = open; end is inclusive). | `getAdForPlacement.ts`, `repos/campaign.repo.ts` (findByIds, org-scoped) | No | Must land with/before FIX-009 — does |
| (hardening) | `reportAd` rejects a cross-org creative (404, no leak); `CampaignRepository.findByIds` accepts + filters by `organizationId`. | `reportAd.ts`, `repos/campaign.repo.ts`, `getAdForPlacement.ts` | No | Mirrors FIX-007/`createOrder.ts` org-isolation precedent |
| (doc) | Corrected stale `advertising_report_threshold` default 5 → 3 (+ window/pause note). | `docs/product/modules/m16-advertising/MODULE_SPEC.md` | No | Only stale advertising-spec line found |

## C5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `setMemberOptOut.test.ts` (rewritten) | backend/unit | Opt-out/opt-in persist via repo (org+person); contract field `optedOut`; fail-closed without org | FIX-008 |
| `getAdForPlacement.test.ts` (rewritten) | backend/unit + permission | Server-side opt-out (no client flag); client flag IGNORED; paused/draft/expired/not-started campaigns NOT served; active in-window served | FIX-008, FIX-010 |
| `reportAd.test.ts` (rewritten) | backend/unit + permission | Report persisted; windowed count; threshold 3 → creative paused (campaign NOT); admin notify fired; below/window no-pause; cross-org report rejected (no persist) | FIX-009, hardening |
| `advertising-flow.hurl` (extended) | integration (Hurl) | E2E: opt-out → generic `member_opted_out` (server-side) → opt-in → serves; client flag cannot force/suppress; real advertiser→campaign→creative; 3 reports persist (count 1→2→3) | FIX-008, FIX-009 |

## C6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/advertising/setMemberOptOut.test.ts` | Passed | RED watched first (no-op handler), then GREEN (5 tests) |
| `bun test src/handlers/advertising/getAdForPlacement.test.ts` | Passed | RED watched (gating + client-flag fails), then GREEN (10 tests) |
| `bun test src/handlers/advertising/reportAd.test.ts` | Passed | RED watched (old `countReports`/campaign-pause), then GREEN (9 tests incl. cross-org) |
| `bun test src/handlers/advertising/` | Passed | 52 pass / 0 fail |
| `bun test` (full api-ts) | Passed (1 pre-existing fail) | **6160 pass / 1 fail / 4 todo** (was 6151; +9). The 1 fail = pre-existing unrelated `registerEmailJobs`. |
| `bun run --filter '*' typecheck` (monorepo) | Passed | 5/5 workspaces, 0 errors |
| `hurl --test advertising-flow.hurl` (live, :7299) | Passed | 19 requests / 100% |
| `API_URL=:7299 bun run test:contract` (full suite) | Partially Passed | 152/155 files; the 3 fails are the documented pre-existing non-advertising files (impersonation, governance position-crud, platformadmin committees) — `advertising-flow.hurl` = Success |

## C7. Validation Summary

- **Passed:** all 3 fixes RED→GREEN at unit level (24 advertising-handler tests across the 3 rewritten files, +9 net); 52 advertising-dir tests; full api-ts suite (6160 pass, no new failures); monorepo typecheck 5/5; live advertising Hurl journey (19 req, 100%); full contract suite advertising file green.
- **Adversarial review:** a 2-lens (correctness + spec) review workflow with per-finding independent verification confirmed 3 real findings — all org-isolation hardening on the handlers being touched (cross-org `reportAd`, unscoped `findByIds`). All three were implemented (cross-org guard added test-first). One P2 (endsAt `<` vs `<=`) was assessed and intentionally kept as an inclusive end-of-window (matches "within starts_at..ends_at").
- **Failed:** None attributable to Batch C. The single api-ts unit fail (`registerEmailJobs`) and the 3 full-suite contract fails are the documented pre-existing/unrelated baseline failures in other modules.
- **Not run / blocked:** Live approved→pending creative auto-pause + paused/expired campaign serve-gating could not be exercised end-to-end via Hurl because `reviewCreative` (out of scope) cannot approve a creative; these are proven deterministically by unit tests instead.

## C8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| notifs | `handlers/notifs/repos/notification.repo.ts` (`createNotificationForModule`) | Called from `reportAd` for the admin auto-pause alert (fire-and-forget, try/catch) | `reportAd.test.ts` asserts notify fired at threshold; restored prototype mock so it does not leak into `notification.repo.test.ts` | `[CROSS-MODULE RISK]` — uses the established module-notification pattern; recipient = `creative.createdBy` `[NEEDS CONFIRMATION]` (interim) |
| database (no migration) | `member_ad_opt_out`, `ad_report`, `ad_campaign.status/starts_at/ends_at` | Writes/reads existing columns only | Live Hurl persists real opt-out + report rows | No schema change |

## C9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Live (Hurl) proof of approved→pending creative auto-pause + paused/expired campaign serve-gating | FIX-009/FIX-010 | `reviewCreative` (out of scope) cannot approve a creative due to a pre-existing validator/handler field mismatch (`approved` vs `decision`) | Fix `reviewCreative`'s contract mismatch in a future pass, then add a live auto-pause journey |
| Per-org configurable report threshold (`advertising_report_threshold`) | FIX-009 | Module constant `REPORT_THRESHOLD = 3` is sufficient for V1; per-org config is `V2 DEFERRED` | Wire a feature-flag/config lookup when associations need different thresholds |
| Budget/pacing serve gating (`spent_cents`, CPM) | FIX-010 (deferred half) | `V2 DEFERRED` `[DO NOT OVERBUILD]` | Only when real ad delivery/billing is built |

## C10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| `reviewCreative` `approved`-vs-`decision` contract mismatch | `[NEEDS CONFIRMATION]` | Pre-existing, out of Batch C scope; blocks live creative approval | Separate fix pass (likely Batch D / its own `04`) |
| G-06 advertising authority model | `[NEEDS PRODUCT DECISION]` | Who may verify/review/serve undecided | Product decision (fix-ready §8 row 1) |
| FIX-009 admin-notify recipient (creative owner vs org admins) | `[NEEDS CONFIRMATION]` | "Admin" recipient is ambiguous; interim uses `creative.createdBy` | Confirm intended recipient; keep fire-and-forget |

## C11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Batch D (reviews G-12 org-scope `listReviews` + `x-audit` on verifyVendor/reviewCreative/fulfillOrder/deleteReview) | (later batch) | Out of selected batch |
| Budget/pacing/spend (`spent_cents`, CPM caps) | `V2 DEFERRED` `[DO NOT OVERBUILD]` | FIX-010 is status+date-window only |
| Ad placements/impressions/analytics/versioning; advertiser portal + suspension cascade; behavioral targeting; member-level ad analytics | `V2 DEFERRED` `[DO NOT OVERBUILD]` | m16 later-phase vision |
| New `paused` value on `creative_status` enum | `[DO NOT OVERBUILD]` | Auto-pause reuses `pending` (re-review) — no migration needed |

## C12. Files Changed (Batch C)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/advertising/setMemberOptOut.ts` | Persist/delete opt-out via repo; read `optedOut`; fail-closed | FIX-008 |
| `services/api-ts/src/handlers/advertising/setMemberOptOut.test.ts` | Rewritten RED-first (persistence asserted) | FIX-008 |
| `services/api-ts/src/handlers/advertising/getAdForPlacement.ts` | Server-side opt-out; ignore client flag; campaign status+schedule gate; org-scoped campaign lookup | FIX-008, FIX-010 |
| `services/api-ts/src/handlers/advertising/getAdForPlacement.test.ts` | Rewritten/extended RED-first (server opt-out, flag-ignored, gating) | FIX-008, FIX-010 |
| `services/api-ts/src/handlers/advertising/reportAd.ts` | Persist report; 7-day window; threshold 3; creative-level auto-pause; admin notify; cross-org guard | FIX-009, hardening |
| `services/api-ts/src/handlers/advertising/reportAd.test.ts` | Rewritten RED-first (+ cross-org test); restore notif prototype mock | FIX-009, hardening |
| `services/api-ts/src/handlers/advertising/repos/optOut.repo.ts` | **New** `MemberAdOptOutRepository` (isOptedOut/optOut/optIn) | FIX-008 |
| `services/api-ts/src/handlers/advertising/repos/creative.repo.ts` | `createReport`, `countReportsWithinDays`, `pauseCreative` | FIX-009 |
| `services/api-ts/src/handlers/advertising/repos/campaign.repo.ts` | `findByIds` (org-scoped) | FIX-010, hardening |
| `specs/api/tests/contract/advertising-flow.hurl` | Real opt-out + report journeys; tightened asserts | FIX-008, FIX-009 |
| `docs/product/modules/m16-advertising/MODULE_SPEC.md` | Threshold default 5 → 3 (+ window/pause note) | FIX-009 (doc) |

## C13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| Live Hurl run (19/19) | `advertising-flow.hurl` against booted+seeded API on :7299 (manual run, recorded in §C6) | FIX-008, FIX-009 |
| Full contract suite (152/155, advertising green) | `API_URL=:7299 bun run test:contract` (recorded in §C6) | FIX-008/009/010 |
| Adversarial review verdicts (3 confirmed, all implemented) | Review workflow `wf_69922d95-6d9` (summarized in §C7) | hardening |

## C14. Completion Decision

`COMPLETE`

All three selected Batch C fixes (FIX-008, FIX-009, FIX-010) are implemented test-first (RED watched failing for the right reason per fix, then minimal GREEN), require no TypeSpec/SDK regen and no migration (existing tables/columns wired), and are validated at unit, type, and integration levels: 24 rewritten advertising-handler tests + the cross-org guard (full api-ts 6160 pass, only the pre-existing unrelated `registerEmailJobs` fail), a clean 5/5 monorepo typecheck, and a live Hurl journey (19 req, 100%) proving server-side opt-out enforcement (client flag ignored both directions) and a real persisted 3-report pipeline. The existing tests that blessed the broken behavior (`setMemberOptOut.test.ts`, `reportAd.test.ts`) were flipped RED-first, not preserved. An adversarial 2-lens review surfaced 3 real org-isolation hardening gaps in the touched handlers, all fixed (cross-org `reportAd` guard added test-first). The only deferred live proofs (approved→pending auto-pause, paused/expired serve-gating) are blocked by an unrelated `reviewCreative` contract mismatch and are instead proven deterministically by unit tests. Working tree preserved; nothing committed.

## C15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for the next item in the remaining-work sequence — either **Batch D (reviews G-12 org-scope `listReviews` + `x-audit` on verifyVendor/reviewCreative/fulfillOrder/deleteReview)** to finish this module, or a decision-free Track-A pass (A10 platform-admin / A11 realtime / A12 dues). The `reviewCreative` `approved`-vs-`decision` contract mismatch discovered this pass is a good candidate to fold into Batch D.

```txt
Module/group: Marketplace/Ads/Reviews
Module slug: marketplace-advertising
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md
Recommended batch: Batch D — Reviews org-scope + x-audit hardening (FIX-011, FIX-012) [+ reviewCreative contract-mismatch fix]
```

---

# Batch D — Reviews scoping + audit hardening (appended 2026-06-12)

> Appended section. Batch A (§1–§15), Batch B (§B1–§B15), and Batch C
> (§C1–§C15) above are unchanged. This documents the **Batch D** pass:
> FIX-011 (org-scope `listReviews`), FIX-012 (`@extension("x-audit", …)` on
> verifyVendor / fulfillOrder / reviewCreative / deleteReview — TypeSpec-first
> → regen), and the bundled **reviewCreative** `{approved}`-vs-`{decision}`
> contract-mismatch fix discovered in Batch C. Reviews is the healthy
> sub-module — the slice was kept tiny.

## D1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Marketplace/Ads/Reviews |
| Module slug | marketplace-advertising |
| Raw gap plan used | `docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md` (G-12, §15 x-audit) |
| Fix-ready plan used | `docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md` (§2 Batch D, §3 FIX-011/012) |
| Output fix report | `docs/aha/module-fix-plans/marketplace-advertising-fix-report.md` (this file) |
| Fix date | 2026-06-12 |
| Batch executed | **Batch D — Reviews scoping + audit hardening** (FIX-011 G-12, FIX-012 §15 x-audit, + reviewCreative contract-mismatch) |
| Superpowers used | Yes — `superpowers:test-driven-development` (RED-first per fix); plus a 5-agent parallel preflight investigation workflow (x-audit pattern, target ops, hurl audit pattern, reviews org-scope precedent, reviewCreative mismatch) |
| Working tree status checked | Yes (`git status --short`; pre-existing AHA dirty tree across ~300 files preserved — incl. Batches A/B/C output and prior membership-lifecycle changes to `core/domain-events.registry.ts` + `member/membership/utils/status-transitions.ts`, NOT touched) |
| Fix scope | Selected P2 (FIX-011, FIX-012) — V1 RECOMMENDED; + the reviewCreative mismatch (correctness bug folded in per the pass instructions) |
| Out of scope | G-13 (reviews person-deletion policy — product-blocked), G-06 authority re-gate, FIX-007 vendor-ownership half (all `[NEEDS PRODUCT DECISION]`); review editing/NPS aggregation; jobs `/postings`; everything in fix-ready §10/§11 |
| Shared files touched | Yes — 3 module `.tsp` files (marketplace/advertising/reviews) + regenerated `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts`, `specs/api/dist/openapi/*`, `packages/sdk-ts/src/generated/*` (x-audit is an operation vendor extension → emits server audit middleware only; NO new operationId → client SDK shape unchanged) |
| Schema/migration touched | No — `review.organizationId` column + `reviews_org_idx` already exist (P0-7); FIX-011 wires existing schema |
| Limitations | None blocking. `getNextBookableTime` (booking, clock-boundary-flaky) and `registerEmailJobs` (email) unit fails are pre-existing/out-of-scope (see D7). |

## D2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-011 | G-12 — `listReviews` never filtered by `organizationId` (column + `reviews_org_idx` exist) → cross-org review exposure to platform-admin queries; officers lacked an org-scoped view | P2 | V1 RECOMMENDED | D | Multi-tenant isolation on a read path; root-cause fix wires existing schema | **Fixed** |
| FIX-012 | §15 — No `x-audit` extensions on 4 trust-sensitive ops (verifyVendor, fulfillOrder, reviewCreative, deleteReview) → decisions left no audit-module trail | P2 | V1 RECOMMENDED | D | Low-risk observability gap; canonical P1.5 declaration fix | **Fixed** |
| reviewCreative mismatch | Pre-existing: handler read `body.decision`/`body.reason` but the contract + generated validator are `{ approved: boolean, rejectionReason? }` → the op ALWAYS 400'd in production (only "passed" against tests that mocked the wrong shape) | P1 (correctness) | (bundled) | D | Discovered in Batch C; blocks live creative approval + the deferred auto-pause proof | **Fixed** |

## D3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `listReviews.test.ts` FIX-011 assertions (NEW +3) | **RED** — 2 fail: org filter never applied (`filters.organizationId` undefined); multi-role admin 403'd on a cross-user filter (buggy `=== 'admin'`) | FIX-011 | Confirmed handler never read `ctx.get('organizationId')` and used the broken role check |
| `reviewCreative.test.ts` (rewritten to contract `{approved}` shape) | **RED** — 4 fail: handler read `body.decision` (undefined under the contract) → every approve/reject/notfound/businesslogic path threw `ValidationError` | reviewCreative | Confirmed the field mismatch (the old test masked it by mocking `{decision}`) |
| `marketplace-advertising-reviews-audit.test.ts` (NEW, 4 assertions) | **RED** — 4 fail: generated `routes.ts` had no `createPerRouteAuditMiddleware(...)` for any of the 4 ops | FIX-012 | Captured before the TypeSpec edit + regen |
| Full api-ts `bun test` (carried from Batch C) | 6160 pass / 1 fail / 4 todo (1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`) | — | Baseline before Batch D |
| Full Hurl suite (carried from Batch C) | 152/155 files (3 pre-existing non-marketplace fails) | — | Re-confirmed bootable |

## D4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-011 | `listReviews` reads `ctx.get('organizationId')` and folds it into the repo filter (audit-style: undefined org → platform-admin cross-org; set org → scoped). Also fixed the role check `session.user.role === 'admin'` → `hasRole(session.user, 'admin')` (the gating FIX-011 depends on; matches `listSurveys`). `ReviewFilters` gained an `organizationId?` field + a conditional `eq(reviews.organizationId, …)` branch in `buildWhereConditions`. | `handlers/reviews/listReviews.ts`, `handlers/reviews/repos/review.repo.ts` | No (module-local; wires existing column/index) | Mirrors the `listAuditLogs` P0-3 fail-open pattern |
| FIX-012 | Added `@extension("x-audit", #{ action, resourceType })` to 4 ops: verifyVendor (`update`/`marketplace-vendor`), fulfillOrder (`complete`/`marketplace-order`) in marketplace.tsp; reviewCreative (`update`/`ad-creative`) in advertising.tsp; deleteReview (`delete`/`review`) in reviews.tsp. Regenerated → `createPerRouteAuditMiddleware(...)` now in the route chain (auth → audit → validators → handler). Enriched the two decision ops (verifyVendor, reviewCreative) with `ctx.set('auditResourceId'/'auditDescription')` to capture the actual outcome (verified/rejected/suspended, approved/rejected); fulfillOrder/deleteReview rely on the path-param resourceId fallback. | `specs/api/src/modules/{marketplace,advertising,reviews}.tsp`; `handlers/marketplace/verifyVendor.ts`; `handlers/advertising/reviewCreative.ts`; regenerated `generated/openapi/*` + `sdk-ts/src/generated/*` | `[SHARED DEPENDENCY]` (TypeSpec→codegen; additive vendor extension only — no operationId/SDK-shape change) | Per CLAUDE.md P1.5; valid action enum + free-form resourceType confirmed against `per-route-audit.ts`/`audit-action.ts` |
| reviewCreative mismatch | Handler now reads the contract fields: `if (typeof body.approved !== 'boolean')` → 400; `if (body.approved === false && !body.rejectionReason?.trim())` → 400; dispatch `approveCreative` / `rejectCreative(…, body.rejectionReason.trim())`. NO TypeSpec change, NO regen. | `handlers/advertising/reviewCreative.ts` (+ test mocks gained a `ctx.set` no-op) | No | The smallest correct fix = align the handler to the existing contract (not change the tsp) |

## D5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `handlers/reviews/listReviews.test.ts` (UPDATED, +3) | backend/unit + permission/RBAC | Non-admin caller org-scoped from ctx; platform admin without org context lists cross-org; multi-role admin recognized via `hasRole` and still org-scoped when org context present | FIX-011 |
| `handlers/advertising/reviewCreative.test.ts` (REWRITTEN) | backend/unit | Contract `{approved}` shape: `approved:true` approves a pending creative; `approved:false`+`rejectionReason` rejects; non-boolean `approved` → 400; `approved:false` without reason → 400; NotFound/BusinessLogic guards intact | reviewCreative |
| `handlers/__tests__/marketplace-advertising-reviews-audit.test.ts` (NEW, 4) | data/schema + regression | Each of the 4 ops emits its `createPerRouteAuditMiddleware({ action, resourceType })` in generated `routes.ts`, bound to the correct op block; goes RED if any x-audit is dropped | FIX-012 |
| `specs/api/tests/contract/reviews-flow.hurl` (UPGRADED) | integration (Hurl) + audit-side-effect | Real create → get → delete (204) journey, then admin queries `/audit/logs?resource={{review_id}}&action=delete` and asserts `totalCount >= 1` — live proof the deleteReview x-audit composes an audit row | FIX-011, FIX-012 |
| `specs/api/tests/contract/advertising-flow.hurl` (EXTENDED) | integration (Hurl) | Inserted reviewCreative `{approved:true}` (creative → approved), then the 3 reports flip the **approved** creative to `autoPaused == true` on the threshold — the Batch-C-deferred live auto-pause proof, now unblocked | reviewCreative, FIX-009 (deferred half) |
| `handlers/marketplace/verifyVendor.test.ts` (UPDATED) | backend/unit | Added a `ctx.set` no-op to the local mock so the enriched audit description path runs (no behavior change) | FIX-012 |

## D6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test listReviews.test.ts` (before/after) | **RED → Passed** | 2 fail → 8 pass / 0 fail |
| `bun test reviewCreative.test.ts` (before/after) | **RED → Passed** | 4 fail → 7 pass / 0 fail |
| `bun test marketplace-advertising-reviews-audit.test.ts` (before/after regen) | **RED → Passed** | 4 fail → 4 pass / 0 fail |
| `cd specs/api && bun run build` | **Passed** | OpenAPI rebuilt; 4 x-audit extensions emitted (only pre-existing `implicitOptionality` deprecation warnings) |
| `cd services/api-ts && bun run generate` | **Passed** | Regenerated routes/validators/registry; **0 new handler stubs** (no new ops) |
| `cd packages/sdk-ts && bun run generate` | **Passed** | SDK regenerated; x-audit adds no operationId → client shape unchanged (transformer warnings are pre-existing billing/booking schemas) |
| `bun test reviews/ advertising/ marketplace/ + 2 regression tests` | **Passed** | 226 pass / 0 fail across 19 files |
| `bun test` (full api-ts) | **Passed (1 pre-existing fail)** | **6167 pass / 1 fail / 4 todo** — +7 vs the 6160 baseline (exactly the new tests). 1 fail = pre-existing unrelated `registerEmailJobs` |
| `bun run --filter '*' typecheck` (monorepo) | **Passed** | 5/5 workspaces (memberry, admin, ui, sdk-ts, api-ts) exit 0 |
| `API_URL=:7299 bun run test:contract` (full suite, live) | **Partially Passed** | **152 / 155 files.** All 4 relevant flows green: marketplace-flow (25), advertising-flow (20), reviews-flow (9), audit-side-effects (7). The 3 fails are the documented pre-existing non-marketplace files (impersonation, governance position-crud, platformadmin-extended) |
| `hurl --test reviews-flow.hurl advertising-flow.hurl` (live, :7299) | **Passed** | 29 req / 100% — isolates the two edited flows incl. the FIX-012 deleteReview audit assertion + the reviewCreative approve→auto-pause journey |

## D7. Validation Summary

- **Passed:** all 3 fixes RED→GREEN at unit level (+7 net tests); OpenAPI build; api-ts + SDK regen (0 new ops); 226 module unit tests; full api-ts suite (6167 pass, no new failures); monorepo typecheck 5/5; the live full Hurl suite (152/155) including the upgraded reviews-flow (real create→delete→**audit-log assertion**, FIX-012 proof) and the extended advertising-flow (reviewCreative approve → report×3 → **autoPaused==true**, the Batch-C-deferred proof now live).
- **Failed:** None attributable to Batch D. Two out-of-scope unit fails: `registerEmailJobs` (email module — the documented pre-existing baseline fail) and `getNextBookableTime > returns a time in the future` (a pure booking clock-boundary-flaky utility — `getNextBookableTime(0)` rounds up to the next 15-min boundary then asserts `>= new Date()`; the booking module is untouched by this batch). The first full-suite-equivalent api-ts run reported only the 1 `registerEmailJobs` fail; the booking flake surfaces intermittently at the minute boundary.
- **Pre-existing/unrelated (contract):** 3 non-marketplace files fail (impersonation, governance position-crud, platformadmin committees authority drift) — other modules, not touched, separate audit concerns.
- **Blocked:** G-13 (reviews person-deletion policy), G-06 (authority re-gate), FIX-007 vendor-ownership half — all `[NEEDS PRODUCT DECISION]`, not touched.

## D8. Shared / Cross-Module / Database Impact

| Area | Files / Components | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Module TypeSpec | `specs/api/src/modules/{marketplace,advertising,reviews}.tsp` | Only the 4 target ops; additive `x-audit` vendor extension | New audit regression test + live audit-log assertion | `[SHARED DEPENDENCY]` — no other op changed; no operationId added |
| Generated routes/validators/registry | `services/api-ts/src/generated/openapi/*` | Hono route table (audit middleware inserted in 4 chains) | Full contract suite 152/155 (no marketplace regressions) | Regenerated, never hand-edited |
| SDK | `packages/sdk-ts/src/generated/*` | Frontends — no client-shape change (x-audit is server-only) | Monorepo typecheck 5/5 | `check:sdk-compat` stays frozen-by-design (NOT `--update`d — milestone Step 6) |
| Audit middleware | `middleware/per-route-audit.ts` (read-only reuse), `core/audit/audit-action.ts` (action enum reference) | The 4 new x-audit chains compose events post-handler (skipped on 4xx/5xx) | `audit-side-effects.hurl` + the upgraded `reviews-flow.hurl` deleteReview assertion | No middleware change — only declarations consume it |
| database | `review.organizationId` + `reviews_org_idx` | FIX-011 reads an existing NOT-NULL column/index | Live reviews-flow create→delete | No migration |

## D9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Live (Hurl) audit assertion for verifyVendor / fulfillOrder / reviewCreative x-audit | FIX-012 | deleteReview's audit row is asserted live; the other 3 are proven by the generated-routes regression test (deterministic) — a per-op live audit-log assertion was not added to keep the slice tiny | Optionally extend marketplace-flow/advertising-flow with `/audit/logs` assertions in a later pass |
| G-13 reviews `person.deleted` subscriber (anonymize/delete/block) | G-13 | `[NEEDS PRODUCT DECISION]` + `[CROSS-MODULE RISK]` (FK RESTRICT) | Product + person-module owner decide deletion policy |
| 3 pre-existing non-marketplace contract failures | (other modules) | Out of scope | Address in those modules' own `04` passes |
| Jobs `/postings` dropped-prefix defect | cross-module sibling of G-01 | Separate module/pass | Run a `04` pass for jobs with the same `@route` fix |

## D10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| G-13 — reviews subscriber for `person.deleted` | `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` | Anonymize-vs-delete-vs-block undecided; FK RESTRICT will fail the cascade | Product + person-module owner decide |
| G-06 — advertising/vendor authority re-gate (platform vs association admin) | `[NEEDS PRODUCT DECISION]` | Authority model undecided | Product decision |
| FIX-007 strict vendor-ownership half | `[NEEDS PRODUCT DECISION]` | No vendor↔user link | Vendor-identity decision |

## D11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Review editing / update endpoint | `DO NOT ADD` | Immutability (delete-only) is a deliberate invariant |
| NPS aggregation / trends inside reviews | `DO NOT ADD` | Owned by `surveys` |
| Per-op live audit-log assertions for verifyVendor/fulfillOrder/reviewCreative | `[DO NOT OVERBUILD]` | Generated-routes regression test + one live deleteReview assertion suffice for V1 |
| Budget/pacing, ad placements/impressions/analytics/versioning, advertiser portal, member marketplace UI, payments/refunds | `V2 DEFERRED` | Excluded by fix-ready §10/§11 |

## D12. Files Changed (Batch D)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/reviews/listReviews.ts` | Org-scope from ctx; `hasRole` role check | FIX-011 |
| `services/api-ts/src/handlers/reviews/repos/review.repo.ts` | `ReviewFilters.organizationId?` + conditional `eq` branch | FIX-011 |
| `services/api-ts/src/handlers/reviews/listReviews.test.ts` | +3 org-scope/role tests | FIX-011 |
| `services/api-ts/src/handlers/advertising/reviewCreative.ts` | Read contract `{approved, rejectionReason}`; + audit `ctx.set` | reviewCreative, FIX-012 |
| `services/api-ts/src/handlers/advertising/reviewCreative.test.ts` | Rewritten to contract shape; `ctx.set` mock | reviewCreative |
| `services/api-ts/src/handlers/marketplace/verifyVendor.ts` | + decision-aware audit `ctx.set` | FIX-012 |
| `services/api-ts/src/handlers/marketplace/verifyVendor.test.ts` | `ctx.set` no-op in mock | FIX-012 |
| `specs/api/src/modules/marketplace.tsp` | `x-audit` on verifyVendor + fulfillOrder | FIX-012 |
| `specs/api/src/modules/advertising.tsp` | `x-audit` on reviewCreative | FIX-012 |
| `specs/api/src/modules/reviews.tsp` | `x-audit` on deleteReview | FIX-012 |
| `services/api-ts/src/handlers/__tests__/marketplace-advertising-reviews-audit.test.ts` | NEW 4-assertion x-audit regression test | FIX-012 |
| `specs/api/tests/contract/reviews-flow.hurl` | Real create→delete→audit-log assertion journey | FIX-011, FIX-012 |
| `specs/api/tests/contract/advertising-flow.hurl` | reviewCreative approve → report×3 → autoPaused==true | reviewCreative, FIX-009 (deferred) |
| `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` | Regenerated (audit middleware on 4 chains; no new ops) | FIX-012 (generated) |
| `packages/sdk-ts/src/generated/*` + `specs/api/dist/openapi/openapi.json` | Regenerated from spec (no client-shape change) | FIX-012 (generated) |

## D13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED→GREEN per fix (2 + 4 + 4 RED → all GREEN) | §D3/§D6 test-run notes | FIX-011/012, reviewCreative |
| Full api-ts suite 6167 pass (+7, 1 pre-existing fail) | §D6 | all |
| Monorepo typecheck 5/5 | §D6 | all |
| Live full Hurl suite 152/155 (4 relevant flows green) | `API_URL=:7299 bun run test:contract` (recorded §D6) | all |
| Live deleteReview audit-log assertion (`/audit/logs?action=delete` totalCount≥1) | `specs/api/tests/contract/reviews-flow.hurl` (9 req vs :7299) | FIX-012 |
| Live reviewCreative approve → auto-pause (`autoPaused==true`) | `specs/api/tests/contract/advertising-flow.hurl` (20 req vs :7299) | reviewCreative, FIX-009 |

## D14. Completion Decision

`COMPLETE`

All selected Batch D items (FIX-011, FIX-012) plus the bundled reviewCreative contract-mismatch fix are implemented test-first (RED watched failing for the right reason per fix, then minimal GREEN), regenerated through the TypeSpec→OpenAPI→routes/validators/registry→SDK pipeline where required (FIX-012 only; no generated file hand-edited; 0 new operationIds so the client SDK shape is unchanged), and validated at four levels: +7 new unit tests (full api-ts 6167 pass, only the pre-existing unrelated `registerEmailJobs` fail), a clean 5/5 monorepo typecheck, a deterministic generated-routes audit regression test, and a live Hurl suite (152/155) whose upgraded reviews-flow asserts the deleteReview x-audit emits a real audit-log row and whose extended advertising-flow proves the reviewCreative fix end-to-end via the now-unblocked approve→report×3→auto-pause journey. The reviewCreative fix also retires the Batch-C limitation that blocked that live proof. The excluded items (G-13, G-06, FIX-007 vendor-ownership) remain `[NEEDS PRODUCT DECISION]` and were not touched. Working tree preserved; nothing committed.

## D15. Recommended Next Step

Batch D completes the Marketplace/Ads/Reviews module's decision-free `04` work (Batches A–D all COMPLETE). Continue the remaining-work sequence with the next decision-free Track-A pass — **A10 Platform-admin Batch B subset**, **A11 Realtime Batch B subset**, or **A12 Dues Batch B subset** — or clear a carry-forward loose end: the **jobs `/postings`** dropped-prefix `04` pass (identical `@route("/association/jobs")` fix as G-01).

```txt
Module/group: (next module) — e.g. Platform-admin / Realtime / Dues, or Jobs (/postings prefix)
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Note: Marketplace/Ads/Reviews Batches A–D are DONE. Remaining marketplace work (G-06, G-13, FIX-007 vendor-ownership) is all product-decision-gated (Track B).
```
