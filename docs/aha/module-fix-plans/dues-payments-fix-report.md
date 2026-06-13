# AHA Module/Group Fix Report: Dues & Payments

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dues & Payments |
| Module slug | dues-payments |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/dues-payments-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/dues-payments-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A (FIX-002 → Batch F migration → FIX-003 → FIX-001) |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked before implementation; TDD/anti-fake-green discipline applied) |
| Working tree status checked | Yes |
| Fix scope | P0 / V1 REQUIRED only (FIX-001, FIX-002, FIX-003) + paired Batch F schema migration |
| Out of scope | Batch B/C/D/E, V2 DEFERRED, DO NOT ADD, gateway-refund call, funnel, token-expiry, PayMongo, partial-refund expiry direction |
| Shared files touched | Yes (receipt-number util, dues schema, migration journal — all module-owned or additive) |
| Schema/migration touched | Yes (Batch F: `0062_dues_receipt_counter.sql` — additive + scoped-unique swap) |
| Limitations | No real-DB test harness exists in this repo (all handler/repo tests are mock-based via `make-ctx.ts`); DB-level atomicity/uniqueness of the receipt counter is enforced by migration 0062 but proven only at the application seam in tests. `DATABASE_URL` not set → migration could not be applied/verified against a live schema (`[BLOCKED BY ENVIRONMENT]` for live apply; SQL hand-written following the validated 0061 pattern). `db:generate` (drizzle-kit) intentionally fails in this env (exit 127) — migration is hand-written, as is repo convention. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-002 | `refundDuesPayment` missing cross-org ownership guard — Treasurer of org A could refund + reverse expiry of org B payments by id | P0 | V1 REQUIRED | A | Tenant-isolation + financial-integrity breach; smallest, fully isolated | Fixed |
| FIX-003 | Cross-org receipt-number collision: hardcoded `'ORG'` prefix + global-unique constraint + count-based (racy) sequence | P0 | V1 REQUIRED | A + F | Blocks WF-044 manual recording in multi-org mode (platform's main deployment) | Fixed |
| FIX-001 | Online payment never recorded in ledger: checkout creates no `DuesPayment` row; webhook reads `metadata.paymentId` (absent), falls back to `pi_…` non-UUID → fund-allocation FK fails → dead-letter; invoice never marked paid; no receipt | P0 | V1 REQUIRED | A (+F prefix) | Flagship WF-038 takes real money with zero financial record; existing tests were fake-green | Fixed |
| Batch F | Receipt-number per-org/year atomic counter table + per-org unique constraint + migration | — | `[SHARED DEPENDENCY]` (db-schema) | F (paired with A per §13) | Schema prerequisite for FIX-003 | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `dues-mutation-auth.test.ts` (new cross-org refund case) | RED — `refundProcessed=true` (org-B payment refunded by org-A officer) | FIX-002 | Confirmed RED for the right reason: no tenant guard existed. |
| `receipt-number-collision.test.ts` (new) | RED — `buildReceiptPrefix` export not found | FIX-003 | Confirmed RED: per-org prefix seam did not exist; sites hardcoded `'ORG'`. |
| `online-payment-ledger.integration.test.ts` (new) Part A | RED — `createdPaymentArg` null (checkout created no row) | FIX-001 | Confirmed RED: checkout minted no ledger row, no `metadata.paymentId`. |
| `online-payment-ledger.integration.test.ts` (new) Part B | RED — `statusUpdate` null (payment never flipped to completed; invoice never marked paid) | FIX-001 | Confirmed RED: webhook settled funds but left no complete ledger record. |
| `dues-payments.repo.test.ts` `getNextReceiptSequence > returns count + 1` | Passing on old count-based impl (obsolete after fix) | FIX-003 | Replaced with atomic-counter assertions (not weakened). |
| Pre-existing unrelated failure: `email/jobs/index.test.ts > registers email.processor as interval job` | RED (fails in isolation; untouched by this pass) | n/a | Email module — not a Batch A regression. |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-002 | Added tenant guard: after `getPayment`, throw `ForbiddenError` when `payment.organizationId !== ctx.organizationId`. Mirrors `confirmPaymentProof` sibling pattern. | `refundDuesPayment.ts` | No | `getPayment` is unscoped (by id); guard enforced in handler. |
| FIX-003 | (a) New `buildReceiptPrefix(orgSlug)` util replaces hardcoded `'ORG'`. (b) `getNextReceiptSequence` rewritten as atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` against new `dues_receipt_counter` table. (c) New `getOrgReceiptPrefix(orgId)` resolves prefix from `organizations.slug`. (d) All 3 recording call sites use the per-org prefix. | `receipt-number.ts`, `dues-payments.repo.ts`, `recordDuesPayment.ts`, `submitPaymentProof.ts`, `initiateOnlinePayment.ts`, `checkoutPaymentToken.ts` | `[SHARED DEPENDENCY]` (receipt util shared by 4 sites) | Root-cause fix of all three causes (prefix, sequence race, global-unique). |
| FIX-003 (Batch F) | Migration `0062_dues_receipt_counter.sql`: create `dues_receipt_counter` (PK `(org, year)`, FK→organization, cascade); drop global `dues_payment_receipt_unique`; add per-org `dues_payment_org_receipt_unique`. Schema + type updated; journal entry added. | `0062_dues_receipt_counter.sql`, `meta/_journal.json`, `dues-payments.schema.ts` | `[SHARED DEPENDENCY]` (db-schema) | Additive + idempotent `DO $$` guards, mirrors validated 0061 hand-written pattern. Flag to prompt-06 DB audit. |
| FIX-001 | (a) `checkoutPaymentToken` now mints a pending `DuesPayment` row (with per-org receipt number) BEFORE the Stripe checkout, and passes its real UUID as `metadata.paymentId` (+ `orgId`/`organizationId`). (b) `createProcessPayment` removes the `pi_…` fallback (throws if `paymentId` absent), loads the pending row, settles by its UUID, flips status to `completed`, and marks the linked invoice paid (non-fatal on already-paid). | `checkoutPaymentToken.ts`, `jobs/processStripePayment.ts` | `[CROSS-MODULE RISK]` — settle delegates into `membership-lifecycle.ts`; tests assert via injected settle. | Structural metadata-contract fix (not a fallback band-aid). Did NOT register the 5 unregistered helper handlers; did NOT change the load-bearing settle math or double-expiry consumer. |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `member/duesspecialassessments/dues-mutation-auth.test.ts` | permission/RBAC + regression | Org-A officer cannot refund org-B payment (403/404, no funds/membership touched); org-A officer CAN refund org-A payment | FIX-002 |
| `member/duesspecialassessments/refundDuesPayment.test.ts` | regression (updated) | Existing refund suite now passes the tenant guard by supplying matching org context | FIX-002 |
| `member/duesspecialassessments/receipt-number-collision.test.ts` (new) | backend/unit + domain | Per-org prefixes are distinct & never `'ORG'`; two orgs' first-of-year receipts differ (no collision); sequence sourced from atomic counter | FIX-003 |
| `association:member/repos/dues-payments.repo.test.ts` | backend/unit (updated) | `getNextReceiptSequence` proves atomic-counter semantics (upsert returns post-increment, sequence = value−1) — replaces obsolete count-based assertions | FIX-003 |
| `member/duesspecialassessments/online-payment-ledger.integration.test.ts` (new) | integration (seam) | Checkout mints pending ledger row + passes real `metadata.paymentId`; webhook settles by that UUID (never `pi_`), flips payment→completed, marks invoice paid | FIX-001 |
| `member/duesspecialassessments/checkoutPaymentToken.test.ts` | regression (updated) | Existing checkout suite stubs the new repo methods (prefix/sequence/createPayment) | FIX-001 |
| `member/duesspecialassessments/recordDuesPayment.test.ts`, `initiateOnlinePayment.test.ts` | regression (updated) | Existing suites stub `getOrgReceiptPrefix` ('ORG') so receipt-format assertions stay valid under the new code path | FIX-003 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test …/dues-mutation-auth.test.ts …/refundDuesPayment.test.ts` | Passed (20/20) | FIX-002 RED→GREEN + refund regression |
| `bun test …/receipt-number-collision.test.ts` | Passed (5/5) | FIX-003 RED→GREEN |
| `bun test …/online-payment-ledger.integration.test.ts` | Passed (2/2) | FIX-001 RED→GREEN |
| `bun test …/stripeWebhook.test.ts …/stripeWebhook.integration.test.ts …/checkoutPaymentToken.test.ts …/online-payment-ledger…` | Passed (16/16) | webhook + checkout regression |
| `bun test src/handlers/member/duesspecialassessments/ …/receipt-number.test.ts` | Passed (286/286 across 37 files) | full dues module |
| `bun test …/dues-payments.repo.test.ts` | Passed (38/38) | repo atomic-counter |
| `bun test <11 Batch A new/changed files>` | Passed (113/113) | consolidated Batch A |
| `bun run typecheck` (`tsc --noEmit`) | Passed | no type errors |
| Full suite (`bun test`, run incidentally) | Partially Passed (5669 pass, 1 fail) | the 1 fail is `email/jobs/index.test.ts` — unrelated, pre-existing, untouched |
| `bun run db:generate` | Not Run / Blocked | drizzle-kit exits 127 in this env (known; migrations hand-written) |
| Live migration apply | Blocked | `DATABASE_URL` not set — `[BLOCKED BY ENVIRONMENT]` |

## 7. Validation Summary

- **Passed:** All three P0 fixes have RED→GREEN tests proving real behavior (cross-org refund rejected with no side-effects; per-org receipts non-colliding from an atomic counter; online payment lands a complete ledger record — row created, settled by real UUID, status→completed, invoice marked paid). Full dues module (286), repo (38), and consolidated Batch A (113) suites pass. Typecheck passes.
- **Failed:** None related to this pass.
- **Not run / blocked:** Live migration apply (`DATABASE_URL` unset); `db:generate` (drizzle-kit unavailable by design). The migration is hand-written following the verified `0061_chat_message_reactions.sql` pattern (idempotent `DO $$` guards) and registered in `_journal.json`.
- **Pre-existing / unrelated:** `email/jobs/index.test.ts > registers email.processor as interval job` fails in isolation and is in the email module — not touched by Batch A, not a regression.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Receipt util | `association:member/utils/receipt-number.ts` (`buildReceiptPrefix` added) | 4 recording call sites (record/submit/initiate/checkout) + repo | `receipt-number.test.ts`, `receipt-number-collision.test.ts` | `[SHARED DEPENDENCY]` — additive function; existing `formatReceiptNumber`/`parseReceiptNumber` regex widened to allow digits in prefix. |
| DB schema/migration | `dues_receipt_counter` (new table); `dues_payment` unique re-scoped to `(org, receipt_number)` | Dues payment recording; seeds (`layer-7-dues.ts` does NOT use receipt fields → unaffected) | Atomic-counter repo test; collision test | `[SHARED DEPENDENCY]` db-schema. Old global `dues_payment_receipt_unique` dropped (no code referenced it; only historical migrations 0011/0019). Flag to prompt-06 DB audit. |
| Settle seam | `jobs/processStripePayment.ts` → `settle-payment.ts` → `membership-lifecycle.ts` | Membership status/expiry on online settlement | FIX-001 test asserts settle called with real paymentId; membership math untouched | `[CROSS-MODULE RISK]` — only added status-flip + invoice-mark AFTER settle; did not alter lifecycle math or the `core/domain-event-consumers.ts` double-expiry path. |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Live migration apply/verify against real Postgres | Batch F | `DATABASE_URL` not set in this env; no test-DB harness | Run migrations on a dev/CI DB; verify counter upsert + per-org unique under real contention |
| DB-level concurrency proof (two concurrent recorders → no duplicate sequence) | FIX-003 | Mock harness cannot exercise real SQL atomicity | Add an integration test once a real-DB harness exists (prompt-06 DB audit) |
| `submitPaymentProof` has no unit test | pre-existing test gap | Out of Batch A scope (receipt change there mirrors covered sites) | Add a focused test in a later pass |
| Batch B (RBAC/validation/privacy/proof-atomicity) | FIX-004/005/006/007-cap/010 | Separate `04` pass per fix-ready plan §4 | Run Batch B next |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Live migration apply | `[BLOCKED BY ENVIRONMENT]` | `DATABASE_URL` unset; drizzle-kit exits 127 | Provide a DB URL / dev DB; apply + smoke-test the migration |
| FIX-007 gateway-refund-API call | `[NEEDS PRODUCT DECISION]` Q-PD6 + `[SHARED DEPENDENCY]` | Out of Batch A; needs product decision + billing surface verification | Batch C/E |
| FIX-009 funnel / first-invoice / Pay-Now | `[NEEDS PRODUCT DECISION]` Q-PD7/Q-PD8 + `[CROSS-MODULE RISK]` | Out of Batch A; cross-module + product decision | Batch C |
| FIX-011 24h pending→expired timeout | depends on FIX-001 | Out of Batch A (FIX-001 now creates pending rows, enabling it later) | Batch C after this pass |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Token expiry 72h→30d + consume-on-confirm | V1 RECOMMENDED `[NEEDS PRODUCT DECISION Q-PD1]` | Blocked on canonical-expiry decision |
| Partial-refund expiry reversal direction | `[NEEDS PRODUCT DECISION Q-PD2]` | Ambiguous in BR-08; out of Batch A |
| PayMongo adapter wiring | `[NEEDS PRODUCT DECISION Q-PD5]` | Unknown if V1 |
| Register the 5 unregistered helper handlers as public endpoints | DO NOT ADD | Superseded by fixing the registered flow (FIX-001); salvage-or-delete only |
| Generic multi-gateway adapter / caching layer | `[DO NOT OVERBUILD]` | Premature; no evidence of need |
| Receipt PDF pipeline rework, multi-currency, SMS/letter dunning, royalty split, observability metrics | V2 DEFERRED | Outside V1 scope |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/duesspecialassessments/refundDuesPayment.ts` | Added cross-org tenant guard (`ForbiddenError` on org mismatch) | FIX-002 |
| `services/api-ts/src/handlers/association:member/utils/receipt-number.ts` | Added `buildReceiptPrefix`; widened format regex to allow digits | FIX-003 |
| `services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts` | Atomic `getNextReceiptSequence` (counter upsert); new `getOrgReceiptPrefix` | FIX-003 |
| `services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts` | New `duesReceiptCounters` table; per-org receipt unique; `DuesReceiptCounter` type | FIX-003 / Batch F |
| `services/api-ts/src/generated/migrations/0062_dues_receipt_counter.sql` | New migration: counter table + scoped unique swap | Batch F |
| `services/api-ts/src/generated/migrations/meta/_journal.json` | Registered 0062 migration | Batch F |
| `services/api-ts/src/handlers/member/duesspecialassessments/recordDuesPayment.ts` | Per-org receipt prefix | FIX-003 |
| `services/api-ts/src/handlers/member/duesspecialassessments/submitPaymentProof.ts` | Per-org receipt prefix | FIX-003 |
| `services/api-ts/src/handlers/member/duesspecialassessments/initiateOnlinePayment.ts` | Per-org receipt prefix | FIX-003 |
| `services/api-ts/src/handlers/member/duesspecialassessments/checkoutPaymentToken.ts` | Mint pending ledger row + correct `metadata.paymentId` | FIX-001 |
| `services/api-ts/src/handlers/member/duesspecialassessments/jobs/processStripePayment.ts` | Settle real row, drop `pi_` fallback, flip status, mark invoice paid | FIX-001 |
| `…/dues-mutation-auth.test.ts` | Cross-org refund RBAC test (new cases) | FIX-002 |
| `…/refundDuesPayment.test.ts` | Org-context fixtures for guard | FIX-002 |
| `…/receipt-number-collision.test.ts` (new) | Per-org prefix + collision test | FIX-003 |
| `…/online-payment-ledger.integration.test.ts` (new) | Checkout+webhook ledger seam test | FIX-001 |
| `…/repos/dues-payments.repo.test.ts` | Atomic-counter assertions | FIX-003 |
| `…/checkoutPaymentToken.test.ts`, `…/recordDuesPayment.test.ts`, `…/initiateOnlinePayment.test.ts` | Stub new repo methods | FIX-001/003 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baseline + GREEN test runs (quoted in §3/§6) | This report | FIX-001/002/003 |
| Typecheck pass | `bun run typecheck` (tsc --noEmit, clean) | all |
| Consolidated Batch A suite 113/113 | `bun test <11 files>` | all |

## 14. Completion Decision

`COMPLETE`

All three Batch A P0 fixes (FIX-002, FIX-003, FIX-001) plus the paired Batch F receipt-counter migration were implemented test-first (RED confirmed for the right reason, then GREEN), with regression coverage and no weakened assertions. Focused validation passed: dues module (286), repo (38), consolidated Batch A (113), and typecheck. The only caveat is environmental — the migration could not be applied against a live DB (`DATABASE_URL` unset; drizzle-kit unavailable by design), so DB-level atomicity/uniqueness is proven at the application seam and asserted by the hand-written migration rather than by a live apply. This is documented as `[BLOCKED BY ENVIRONMENT]` for the live-apply step only and does not block the code-level completion of the batch. The one failing test in the full suite (`email/jobs/index.test.ts`) is pre-existing and unrelated.

## 15. Recommended Next Step

Run the next `04-module-or-group-fix-tdd.md` pass for **Batch B** (FIX-004 RBAC via `x-require-position` TypeSpec extensions, FIX-005 `validateFundSplits` wiring, FIX-006 `listDuesInvoices` self-scope, FIX-007 over-refund cap + eligibility, FIX-010 `confirmPaymentProof` transaction atomicity).

- Module/group: Dues & Payments
- Module slug: dues-payments
- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Input fix-ready plan: `docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md`
- Selected batch: Batch B — P1 RBAC / validation / privacy / proof atomicity

Separately, when a DB is available, apply migration `0062_dues_receipt_counter.sql` and add a real-DB integration test for concurrent receipt issuance (defer to `06-database-schema-audit.md`).

---

# AHA Module/Group Fix Report: Dues & Payments — **Batch B subset** (FIX-004 + FIX-005 + FIX-006)

> Appended 2026-06-12. Batch A (above) is unchanged. This section covers the **decision-free Batch B subset only**: the RBAC position gate (FIX-004), server-side fund-split validation (FIX-005), and invoice self-scope (FIX-006). FIX-007 (over-refund cap) and FIX-010 (proof-atomicity) are Batch B in the fix-ready plan but were **excluded** from this pass because they touch the load-bearing settle/refund/expiry seam — they run as a dedicated settle-seam pass.

## B.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dues & Payments |
| Module slug | dues-payments |
| Raw gap plan used | `docs/aha/module-gap-plans/dues-payments-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md` (§3 FIX-004/005/006) |
| Output fix report | `docs/aha/module-fix-plans/dues-payments-fix-report.md` (this file, appended) |
| Fix date | 2026-06-12 |
| Batch executed | Batch B **subset** — FIX-004 + FIX-005 + FIX-006 (decision-free) |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked before implementation; RED→GREEN per fix; anti-fake-green discipline) |
| Working tree status checked | Yes (dirty from prior AHA passes incl. dues Batch A + realtime Batch B — preserved; only the 4 in-scope source files + 3 new tests + regenerated `generated/*` are this pass's) |
| Fix scope | P1 / V1 REQUIRED only (FIX-004, FIX-005, FIX-006) |
| Out of scope | FIX-007/010 (settle-seam), FIX-007-gateway, FIX-008/009, Batch C, all PD-gated items, V2 DEFERRED, DO NOT ADD, `createDuesConfig` (not in the FIX-004 list) |
| Shared files touched | Yes — `specs/api` TypeSpec + regenerated `generated/*` (routes/validators/registry/openapi/types/SDK); `dues.repo.ts` filter interface (additive). **No** schema/migration. |
| Schema/migration touched | No |
| Limitations | FIX-004 proven by a **generated-output assertion** (route middleware wiring) + the pre-existing `requirePositionMiddleware` unit tests — not by a live boot in this pass (deterministic and sufficient; live Hurl 403 optional, not run). The existing `dues-mutation-auth.test.ts` calls handlers **directly**, so it cannot observe route-level generated middleware — hence the routes-assertion approach. |

## B.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-004 | 11 financial dues mutations missing a Treasurer/President position gate — gateway creds / dues amounts / fund splits / dunning mutable by any `association:admin` org member | P1 | V1 REQUIRED | B | ROLE_PERMISSION_MATRIX §3.4 violation; existing `x-require-position` precedent in `dues-custom.tsp`; P1.5 mandates the TypeSpec-extension path | Fixed |
| FIX-005 | `upsertDuesFunds` performs zero server-side validation — fund percentages need not sum to 100; silent mis-allocation | P1 | V1 REQUIRED | B | BR-05 server-side; util (`validateFundSplits`) already exists — wire it | Fixed |
| FIX-006 | `listDuesInvoices` returns ALL org invoices + member names + amounts to any member (no self-scope) | P1 | V1 REQUIRED | B | Org-wide financial-privacy leak; `listDuesPayments` already self-scopes (PAY-02) | Fixed |

## B.3 Baseline Before Changes (RED, watched fail first)

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `dues-position-gate.routes.test.ts` (new, 11 ops) | RED — 11/11 fail; generated `routes.ts` route blocks for all 11 ops lacked `requirePositionMiddleware({ titles: ["Treasurer", "President"] })` | FIX-004 | Confirmed RED for the right reason (sliced block showed `authMiddleware → audit → zValidator`, no position MW). |
| `upsertDuesFunds.test.ts` (new) invalid-sum / over-100 / empty-list | RED — handler resolved (no validation), `replaceFunds` ran, no throw | FIX-005 | Confirmed RED: zero server-side validation existed. |
| `listDuesInvoices.test.ts` (new) non-officer cases | RED — `capturedFilter.personId` undefined (expected `'user-1'`); handler never self-scoped | FIX-006 | Confirmed RED: any member saw all org invoices. |
| Full api-ts `bun test` baseline | 6187 pass / 1 fail / 4 todo (1 fail = pre-existing `registerEmailJobs`) | — | Recorded per continuation prompt. |

## B.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-004 | Added `@extension("x-require-position", #["Treasurer", "President"])` to the 11 ops (`updateDuesConfig`, `deleteDuesConfig`, `recalculateAgingBucket`, `createDunningTemplate`, `updateDunningTemplate`, `deleteDunningTemplate`, `runDunning`, `upsertDuesGatewayConfig`, `testDuesGatewayConnection`, `disconnectDuesGateway`, `upsertDuesFunds`). Regenerated via `cd specs/api && bun run build` → `cd services/api-ts && bun run generate`. Chain order emitted: `auth → requirePositionMiddleware (path mode) → audit → validators → handler`. The two stubs (`runDunning`, `recalculateAgingBucket`) were **gated only** — logic untouched (that is FIX-008/Batch C). | `specs/api/src/association/member/dues.tsp` + regenerated `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts`, `specs/api/dist/openapi/*`, `dist/typescript-types/*`, SDK | `[SHARED DEPENDENCY]` (TypeSpec/generate pipeline; generated files never hand-edited) | Path-mode `requirePositionMiddleware.resolveOrgId` reads `:organizationId` path param when present (6 ops) and **falls back to `ctx.get('organizationId')`** (the org-context-verified caller org) for the 5 ops without it. org-context middleware fails closed (verifies membership) before the gate runs, so the gate always has a valid caller org. |
| FIX-005 | Build `FundSplit[]` from the **numeric** incoming `{ fundName, percentage }` (not the stringified DB value), call `validateFundSplits`, and `throw new ValidationError(msg)` when non-null — **before** `repo.replaceFunds`. | `services/api-ts/src/handlers/member/duesspecialassessments/upsertDuesFunds.ts` | No (imports existing `member/membership/utils/fund-math`) | Reuses the existing util (returns `null`|error string; empty list → error). No DB write on invalid splits. |
| FIX-006 | Mirror PAY-02: `requireOfficerTerm(ctx)` → `isOfficer`; non-officers pinned to `personId = session.user.id`, officers see all. Added a `personId` filter field to `DuesInvoiceFilters` + a where-condition. | `services/api-ts/src/handlers/member/duesspecialassessments/listDuesInvoices.ts`, `services/api-ts/src/handlers/association:member/repos/dues.repo.ts` | No (additive filter field; no schema/table change — `dues_invoice.person_id` column already exists) | Resolves the fix-ready `[NEEDS CONFIRMATION]`: invoices carry a `personId` column, so personId self-scope (consistent with `listDuesPayments`) is correct and simpler than membership resolution. AND-composed with org+membership filters, so an attacker-supplied `membershipId` yields zero rows. |

## B.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `member/duesspecialassessments/dues-position-gate.routes.test.ts` (new) | permission/RBAC (generated-output assertion) | Each of the 11 financial ops' generated route registration carries `requirePositionMiddleware({ titles: ["Treasurer", "President"] })` before the handler (per-op block isolation via `lastIndexOf('app.', registryIdx)`) | FIX-004 |
| `member/duesspecialassessments/upsertDuesFunds.test.ts` (new) | backend/unit | Splits summing <100, >100, or empty are rejected with `ValidationError` and **no** `replaceFunds` call; exactly-100 persists + returns 200 | FIX-005 |
| `member/duesspecialassessments/listDuesInvoices.test.ts` (new) | permission/RBAC | Non-officer pinned to own `personId` (even with attacker `membershipId`, which is preserved → AND → zero rows); officer sees all (`personId` undefined) | FIX-006 |

## B.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test …/upsertDuesFunds.test.ts …/listDuesInvoices.test.ts` (pre-fix) | Failed (5 fail / 2 pass) | RED confirmed for FIX-005 + FIX-006 |
| `bun test …/dues-position-gate.routes.test.ts` (pre-regen) | Failed (11 fail) | RED confirmed for FIX-004 |
| `bun test <3 Batch B files>` (post-fix) | Passed (18/18, 47 expect) | RED→GREEN for all three fixes |
| `bun test src/handlers/member/duesspecialassessments/` | Passed (301/301 across 39 files) | Full dues module suite |
| `bun test` (full api-ts) | Passed (6205 pass / 1 fail / 4 todo) | +18 vs baseline; the 1 fail is the pre-existing, unrelated `email/jobs/index.test.ts > registers email.processor` (env-dependent 1000 vs 30000) — not this batch |
| `cd specs/api && bun run build` | Passed | OpenAPI + types regenerated (893 pre-existing implicitOptionality warnings, 0 errors) |
| `cd services/api-ts && bun run generate` | Passed | routes/validators/registry regenerated; 0 new handler stubs |
| `bun run --filter '*' typecheck` | Passed (5/5: ui, admin, sdk-ts, api-ts, memberry all exit 0) | No type errors from regen or handler edits |
| Live Hurl 403 RBAC proof | Not Run | Optional; generated-output assertion + existing `requirePositionMiddleware` unit tests are deterministic proof |
| `check:sdk-compat` | Not Run (by design exits 1; frozen baseline) | FIX-004 adds only a middleware extension — no operationId/SDK-surface change → not `--update`d (milestone Step 6) |

## B.7 Validation Summary

- **Passed:** All three fixes implemented test-first (RED watched failing for the right reason → GREEN). 18/18 Batch B tests; 301/301 dues module; 6205 pass full api-ts; typecheck 5/5; TypeSpec build + generate clean.
- **Failed:** None related to this pass.
- **Pre-existing / unrelated:** `email/jobs/index.test.ts > registers email.processor as interval job` (email module, env-dependent) — same single failure as the recorded baseline, untouched by this batch. `getNextBookableTime` (booking clock-boundary flaky) passed this run.
- **Not run / blocked:** Live Hurl RBAC proof (optional; not needed given deterministic wiring proof). The 3 known pre-existing Hurl failures (`impersonation-flow`, `member/governance/position-crud`, `platformadmin-extended-flow`) are not dues and not attributable here.

## B.8 Adversarial Verification (3 independent lenses: Correctness / Scope / Test-Integrity)

A 3-agent adversarial pass reviewed the diff. Outcome and resolution:

| Finding (lens) | Verdict | Resolution |
| --- | --- | --- |
| FIX-005 fund-split validation correct (Correctness) | SOLID | No action. |
| FIX-006 non-officer self-scope correct (Correctness) | SOLID | No action. |
| FIX-004 `createDunningTemplate` "trusts unverified `x-org-id`" (Correctness, must-fix) | **Refuted** | `orgContextMiddleware` (fail-closed) **verifies active membership** in the resolved org (`org-context.ts:130-139`) before the handler. Not a hole; FIX-004 *tightens* it (now also Treasurer/President). Reviewer conflated the fail-open optional variant. |
| FIX-004 `updateDunningTemplate`/`deleteDunningTemplate` cross-org (Correctness, must-fix) | **Refuted** | Both already enforce `existing.organizationId !== ctx.organizationId` (lines 27-28). No hole. |
| FIX-004 `updateDuesConfig`/`deleteDuesConfig` cross-org by-id (Correctness, must-fix) | **Valid but out of scope → logged** | These two fetch by id and check only `!existing` — **no** org-ownership guard (a pre-existing FIX-002-style tenant gap). FIX-004 still correctly applies the **position gate** (its stated job). The cross-org tenant guard is a *separate* fix, not in the decision-free subset → see B.9 Remaining Gaps. **Not fixed this pass** (AHA scope discipline). |
| "Out-of-scope: `refundDuesPayment.ts` FIX-002 change" (Scope/Test-Integrity, must-fix) | **Refuted (false positive)** | `refundDuesPayment.ts`/`.test.ts` are **Batch A's** FIX-002 work (prior fix report §4/§12, 2026-06-11). This session made **zero** edits to them; they are pre-existing dirty-tree files the continuation prompt instructed to preserve. |
| FIX-005 test comment header said `[FIX-004]` (Test-Integrity, should-fix) | **Fixed** | Corrected to `[FIX-005]`. |
| FIX-006 test didn't assert `membershipId` preserved (Test-Integrity, should-fix) | **Fixed** | Added `expect(capturedFilter.membershipId).toBe('someone-elses-membership')` — proves self-scope ANDs (not replaces) the membership filter. |

## B.9 Remaining Gaps (incl. newly surfaced)

| Gap | Source | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| **`updateDuesConfig` / `deleteDuesConfig` lack a cross-org tenant guard** — fetch config by id and mutate/soft-delete without checking `existing.organizationId === ctx.organizationId`. A Treasurer/President of org A (passing their own `x-org-id`) could update/delete org B's dues config by supplying its id. | Newly surfaced by adversarial Correctness lens `[NEEDS CONFIRMATION]` | Out of the FIX-004 (position-gate) scope; it is a FIX-002-style handler tenant guard, a *separate* fix | Add `if (existing.organizationId !== ctx.get('organizationId')) throw new ForbiddenError()` to both handlers (mirror `confirmPaymentProof`/`updateDunningTemplate`), test-first. Bundle with the settle-seam / tenant-guard hardening pass. |
| FIX-007 (over-refund cap + eligibility) + FIX-010 (`confirmPaymentProof` transaction atomicity) | fix-ready §4 Batch B | Touch the load-bearing settle/refund/expiry seam (`refundDuesPayment.ts`/`confirmPaymentProof.ts` → `settle-payment.ts` → `membership-lifecycle.ts`) `[CROSS-MODULE RISK]` | Run as a dedicated settle-seam pass with membership-status side-effect assertions |
| `runDunning` body-org targeting (`body.organizationId` can target another org's templates) | fix-ready §10 | Folds into FIX-008 dunning wiring | Enforce `body.organizationId === ctx.organizationId` when wiring FIX-008 (do not over-scope here) |

## B.10 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Live Hurl RBAC 403 proof | (optional, not run) | Deterministic generated-output assertion + existing middleware unit tests already prove the gate | Boot API on 7299 + seeded non-officer if a live contract case is later desired |
| FIX-007-gateway / FIX-008 / FIX-009 / FIX-011..016 | `[NEEDS PRODUCT DECISION]` / `[CROSS-MODULE RISK]` | Batch C; PD-gated or cross-module | Product decisions (Q-PD1/2/5/6/7/8) + their batches |

## B.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| `createDuesConfig` position gate | (out of FIX-004 list) | Not in the fix-ready §3 FIX-004 op list; `[NEEDS CONFIRMATION]` whether it should also be gated — flag, do not expand scope |
| FIX-007 / FIX-010 settle-seam fixes | fix-ready Batch B (settle-seam) | Excluded from the decision-free subset (cross-module risk) |
| Token-expiry / PayMongo / partial-refund-direction | `[NEEDS PRODUCT DECISION]` | Q-PD1/Q-PD5/Q-PD2 |

## B.12 Files Changed (this pass)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `specs/api/src/association/member/dues.tsp` | Added `x-require-position` Treasurer/President extension to 11 ops | FIX-004 |
| `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts`, `specs/api/dist/openapi/*`, `dist/typescript-types/*`, SDK | Regenerated (expected churn; never hand-edited) | FIX-004 |
| `services/api-ts/src/handlers/member/duesspecialassessments/upsertDuesFunds.ts` | Wire `validateFundSplits` before `replaceFunds`; throw `ValidationError` | FIX-005 |
| `services/api-ts/src/handlers/member/duesspecialassessments/listDuesInvoices.ts` | PAY-02 self-scope for non-officers | FIX-006 |
| `services/api-ts/src/handlers/association:member/repos/dues.repo.ts` | Added `personId` filter field + where-condition to `DuesInvoiceFilters` | FIX-006 |
| `…/dues-position-gate.routes.test.ts` (new) | 11-op generated-middleware assertion | FIX-004 |
| `…/upsertDuesFunds.test.ts` (new) | Fund-split validation tests | FIX-005 |
| `…/listDuesInvoices.test.ts` (new) | Invoice self-scope tests | FIX-006 |

## B.13 Completion Decision

`COMPLETE`

The decision-free Batch B subset (FIX-004 position gate on 11 ops, FIX-005 server-side fund-split validation, FIX-006 invoice self-scope) was implemented test-first (RED confirmed → GREEN), with no weakened assertions. Focused (18/18), module (301/301), and full-suite (6205 pass / 1 pre-existing fail) tests pass; monorepo typecheck 5/5; TypeSpec build + generate clean. Adversarial verification confirmed FIX-005/006 SOLID and FIX-004's position gate correctly wired and enforced; two test-integrity nits were fixed; one genuine *separate* finding (`updateDuesConfig`/`deleteDuesConfig` cross-org tenant guard) was surfaced and logged for a follow-up tenant-guard pass (out of this subset, not introduced by this work). FIX-007/010 were intentionally excluded (settle-seam).

## B.14 Recommended Next Step

Per the remaining-work sequence (todolist), this completes **A12 (Dues Batch B subset)**. Next:

- **A13 — Training Batch E** (FIX-014 real E2E proof of the P0 credit journey): run `docs/aha/prompts/04-module-or-group-fix-tdd.md` for Training.

Carry-forward (slot anytime): the **dues settle-seam pass** (FIX-007 over-refund cap + FIX-010 proof-atomicity) **plus the newly-surfaced `updateDuesConfig`/`deleteDuesConfig` cross-org tenant guard** — bundle these as one focused tenant-guard/settle-seam `04` pass with membership-status side-effect assertions.

---

# AHA Module/Group Fix Report: Dues & Payments — **Settle-seam pass** (FIX-007 cap + eligibility, FIX-010 proof atomicity, config cross-org tenant guard)

> Appended 2026-06-12. Batch A and Batch B subset (above) are unchanged. This section covers the **settle-seam / tenant-guard carry-forward** flagged in B.9/B.14: FIX-007 over-refund cap + `validateRefundEligibility` wiring (NOT the gateway-API call — Q-PD6 gated), FIX-010 `confirmPaymentProof` transaction atomicity, and the `updateDuesConfig`/`deleteDuesConfig` cross-org tenant guard surfaced by the Batch B adversarial review. Pass id: `dues-settle-seam`.

## C.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dues & Payments |
| Module slug | dues-payments |
| Raw gap plan used | `docs/aha/module-gap-plans/dues-payments-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md` (§3 FIX-007 cap+eligibility, FIX-010; §B.9 config tenant guard) |
| Output fix report | `docs/aha/module-fix-plans/dues-payments-fix-report.md` (this file, appended) |
| Fix date | 2026-06-12 |
| Batch executed | Settle-seam pass — FIX-007 (cap + eligibility), FIX-010, + `updateDuesConfig`/`deleteDuesConfig` cross-org tenant guard |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked before implementation; RED→GREEN per fix; anti-fake-green discipline) |
| Working tree status checked | Yes (intentionally dirty from prior AHA passes — preserved; only the 4 in-scope source files + 2 modified tests + 2 new test files are this pass's. No forbidden git commands used.) |
| Fix scope | P1/P2 / V1 REQUIRED — FIX-007 over-refund cap + eligibility, FIX-010 proof-atomicity, config cross-org tenant guard |
| Out of scope | FIX-007 **gateway-refund-API call** (Q-PD6 + billing dependency — DID NOT TOUCH), partial-refund expiry-reversal **direction** (Q-PD2 — gated; current full-refund-only behavior preserved + locked by a boundary test), FIX-008/009/011..016, Batch C, V2 DEFERRED, DO NOT ADD |
| Shared files touched | No new shared files. Wired the EXISTING `association:member/utils/refund-validation.ts` util (no edit to it). FIX-010 threads the EXISTING `settlePayment` `tx` param (no settle-seam math changed). |
| Schema/migration touched | No |
| Limitations | All tests are mock-based (`make-ctx.ts`); DB-level transaction rollback for FIX-010 is proven at the application seam (status-update + invoice-markPaid run inside the same `db.transaction` callback; markPaid failure propagates instead of being swallowed) — real-Postgres rollback proof requires a live-DB harness that does not exist in this env. The over-refund cap uses the existing `validateRefundEligibility` (returns `EXCEEDS_REFUNDABLE`) — DID NOT call any gateway refund API (Q-PD6). |

## C.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-007 (cap + eligibility) | Refund unguarded against over-refund (repeated partials can cumulatively exceed paid); `validateRefundEligibility` util unwired | P1 | V1 REQUIRED | settle-seam | Books could show refunds exceeding receipts; util already exists — wire it (cap + status + 30-day window). Gateway-call portion explicitly NOT done (Q-PD6). | Fixed |
| FIX-010 | `confirmPaymentProof` settles in its OWN inner tx, then status update + invoice markPaid run OUTSIDE any tx; invoice failures swallowed by bare `catch {}` → partial-failure leaves expiry extended with payment stuck `submitted` | P2 | V1 REQUIRED (data-integrity on a working flow) | settle-seam | PH bank-transfer proof flow is a fully-working V1 path; partial-failure corrupts financial state silently. Mirror `recordDuesPayment` single-transaction pattern. | Fixed |
| Config cross-org tenant guard | `updateDuesConfig`/`deleteDuesConfig` fetch config by id and mutate/soft-delete WITHOUT `existing.organizationId === ctx.organizationId` — a Treasurer/President of org A could mutate/delete org B's dues config by supplying its id | P1 (FIX-002-style tenant breach) | V1 REQUIRED | settle-seam | Surfaced by Batch B adversarial Correctness lens (B.9). Position gate alone (FIX-004) does not stop cross-org by-id access. | Fixed |

## C.3 Baseline Before Changes (RED, watched fail first)

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `dues-config-tenant-guard.test.ts` (new) cross-org update/delete | RED — `mutated`/`deleted` = true (org-A caller mutated/deleted org-B config); the same-org cases passed | config tenant guard | Confirmed RED for the right reason: no `organizationId` check existed in either handler. |
| `refundDuesPayment.test.ts` (new) `[FIX-007] rejects refund exceeding remaining` | RED — promise RESOLVED (3000 refund on 2000 remaining succeeded; no cap) | FIX-007 | Confirmed RED: handler did not cap, never called `validateRefundEligibility`. |
| `refundDuesPayment.test.ts` (new) `[FIX-007] rejects refund outside 30-day window` | RED — promise RESOLVED (45-day-old payment refunded; window not enforced) | FIX-007 | Confirmed RED: eligibility util unwired. |
| `confirmPaymentProof.test.ts` (new) `runs status update + invoice markPaid INSIDE the transaction` | RED — `statusUpdateInsideTx=false` (status update ran after settle's own tx closed) | FIX-010 | Confirmed RED: non-transactional settle + status. |
| `confirmPaymentProof.test.ts` (new) `invoice markPaid failure rejects the whole operation` | RED — promise RESOLVED (markPaid throw swallowed by bare `catch {}`) | FIX-010 | Confirmed RED: silent swallow of invoice write failure. |
| Full api-ts `bun test` baseline | 6263 pass / 1 fail / 4 todo (1 fail = pre-existing `registerEmailJobs`; pass count above the ~6205 doc baseline because prior AHA passes' tests have since landed in the dirty tree) | — | Recorded; the 1 fail is unrelated/pre-existing per prompt. |

## C.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-007 | After the existing tenant guard + `ALREADY_REFUNDED` check, call `validateRefundEligibility({paymentStatus, paymentPaidAt, paymentAmount, alreadyRefunded, requestedRefundAmount})`; throw `BusinessLogicError(reason, code)` when not eligible (covers `EXCEEDS_REFUNDABLE` over-refund cap, `INVALID_STATUS`, `REFUND_WINDOW_EXPIRED`, `NOTHING_TO_REFUND`). Cap the effective refund to `remaining = amount - alreadyRefunded`; recompute `isFullRefund = alreadyRefunded + refundAmount >= amount` (cumulative-correct). | `member/duesspecialassessments/refundDuesPayment.ts` | No — imports the EXISTING `association:member/utils/refund-validation.ts` (not edited). | DID NOT call the gateway refund API (Q-PD6 gated). The `isFullRefund` cumulative fix correctly treats a final partial that completes the total as a full refund; genuinely-partial (below full) still does NOT reverse expiry — Q-PD2 boundary preserved + locked by a test. `[CROSS-MODULE RISK]` — refund delegates into `membership-lifecycle.processRefund`; tests assert expiry-reset side-effect direction. |
| FIX-010 | Wrap settle + payment-status update + invoice markPaid in ONE `db.transaction` (mirror `recordDuesPayment`): pass `tx` to `settlePayment` (reuses outer tx), build `new DuesRepository(tx)` + `new DuesInvoiceRepository(tx)`, and REMOVE the bare `catch {}` so invoice-markPaid failures propagate and roll the whole confirmation back. | `member/duesspecialassessments/confirmPaymentProof.ts` | No — threads the EXISTING `settlePayment` `tx` param; no settle/lifecycle math touched. | `[CROSS-MODULE RISK]` — settle delegates into `membership-lifecycle`. Did NOT touch the `core/domain-event-consumers.ts` double-expiry path. The previous swallow masked genuine write failures; the `payment.status==='submitted'` precondition already prevents the legitimate already-confirmed case. |
| Config tenant guard | Added `if (existing.organizationId !== ctx.get('organizationId')) throw new ForbiddenError(...)` to both `updateDuesConfig` and `deleteDuesConfig`, after the `findOneById`/NotFound check, before mutate/delete. Mirrors `confirmPaymentProof`/`refundDuesPayment`/`updateDunningTemplate`. | `member/duesspecialassessments/updateDuesConfig.ts`, `member/duesspecialassessments/deleteDuesConfig.ts` | No | `duesConfigs` table carries `organizationId` (verified in `dues/repos/dues.schema.ts`). |

## C.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `member/duesspecialassessments/dues-config-tenant-guard.test.ts` (new) | permission/RBAC + regression | org-A caller cannot update/delete org-B config (rejected, repo NOT mutated/deleted); org-A caller CAN update/delete org-A config | config tenant guard |
| `member/duesspecialassessments/refundDuesPayment.test.ts` (updated: +4 cases, fixture `paidAt`) | backend/unit + domain workflow | over-refund (3000 on 2000 remaining) rejected with funds/membership untouched; refund within remaining allowed; cumulative-full → status `refunded`; out-of-window refund rejected; genuinely-partial refund stays `partiallyRefunded` and does NOT reset `duesExpiryDate` (Q-PD2 boundary) | FIX-007 |
| `member/duesspecialassessments/confirmPaymentProof.test.ts` (new) | backend/unit + domain workflow (failure injection) | happy-path confirm settles + marks invoice paid (200); status update + invoice markPaid both run INSIDE the outer transaction; an invoice-markPaid failure propagates (not swallowed) so the whole confirmation rejects/rolls back | FIX-010 |
| `member/duesspecialassessments/dues-mutation-auth.test.ts` (updated: fixture `paidAt`) | regression | the FIX-002 "allows refund of own org's payment" case still proves the org guard ALLOWS a legitimate refund once eligibility (FIX-007) is wired (completed payment now carries a realistic recent `paidAt`) | FIX-007 (regression) |

## C.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test …/dues-config-tenant-guard.test.ts` (pre-fix) | Failed (2 fail / 2 pass) | RED confirmed for the config tenant guard |
| `bun test …/refundDuesPayment.test.ts` (pre-fix) | Failed (2 fail / 12 pass) | RED confirmed for FIX-007 over-refund + window |
| `bun test …/confirmPaymentProof.test.ts` (pre-fix) | Failed (2 fail / 1 pass) | RED confirmed for FIX-010 in-tx + swallowed-error |
| `bun test <4 in-scope test files>` (post-fix) | Passed (31/31, 75 expect) | RED→GREEN for all three fixes |
| `bun test src/handlers/member/duesspecialassessments/` | Passed (312/312 across 41 files) | Full dues module (+11 new tests vs prior 301) |
| `bun test src/core/domain-event-consumers.test.ts src/handlers/member/membership/` | Passed (675/675 across 38 files) | Cross-module settle-seam blast radius clean (no membership/expiry regression) |
| `bun test` (full api-ts) | Passed (6263 pass / 1 fail / 4 todo) | The 1 fail is the pre-existing, unrelated `email/jobs/index.test.ts > registers email.processor` (env-dependent 1000 vs 30000) — not this pass |
| `bun run typecheck` (api-ts, `tsc --noEmit`) | Passed | clean |
| `bun run --filter '*' typecheck` | Passed (5/5: @monobase/ui, admin, @monobase/sdk-ts, @monobase/api-ts, memberry all exit 0) | No type errors from handler edits |

## C.7 Validation Summary

- **Passed:** All three fixes implemented test-first (RED watched failing for the right reason → minimal GREEN), no weakened assertions. 31/31 focused; 312/312 dues module; 675/675 membership + domain-event-consumers (cross-module seam clean); 6263 pass full api-ts; monorepo typecheck 5/5.
- **Failed:** None related to this pass.
- **Pre-existing / unrelated:** `email/jobs/index.test.ts > registers email.processor as interval job` (email module, env-dependent) — the same single failure as the recorded baseline, untouched by this pass.
- **Not run / blocked:** Live-DB transaction-rollback proof for FIX-010 (no real-Postgres harness in this env — proven at the application seam). FIX-007 gateway-refund-API call (Q-PD6 product decision + billing dependency — out of scope, NOT touched).

## C.8 Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Settle seam (refund) | `refundDuesPayment.ts` → `membershipLifecycle.processRefund` | Membership expiry/status on refund | `refundDuesPayment.test.ts` asserts expiry-reset direction (full vs partial) | `[CROSS-MODULE RISK]` — did NOT change `processRefund` math; only capped the amount + corrected the `isFullRefund` flag passed in. |
| Settle seam (confirm) | `confirmPaymentProof.ts` → `settlePayment` (`tx` param) → `membershipLifecycle.settlePayment` | Membership expiry on proof confirmation | `confirmPaymentProof.test.ts` asserts status+invoice inside tx + rollback on invoice failure; `domain-event-consumers` + membership suites green | `[CROSS-MODULE RISK]` — reused the existing `tx` threading (same pattern as `recordDuesPayment`); did NOT alter lifecycle math or the `core/domain-event-consumers.ts` double-expiry path. |

## C.9 Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| FIX-007 gateway-refund-API call (actually return gateway-paid money) | fix-ready §9 + Q-PD6 | `[NEEDS PRODUCT DECISION]` Q-PD6 (V1 ledger-only vs gateway) + `[SHARED DEPENDENCY]` billing connected-account refund surface | Batch C/E after Q-PD6 + billing-surface verification |
| Partial-refund expiry-reversal direction (whether a genuinely-partial refund reverses expiry proportionally) | fix-ready §8 Q-PD2 / FIX-015 | `[NEEDS PRODUCT DECISION]` Q-PD2 — gated; current full-refund-only behavior preserved + locked by a boundary test | Answer Q-PD2; the allocation-sum rounding part (FIX-015) can proceed independently |
| Live-DB rollback proof for FIX-010 | FIX-010 | No real-Postgres test harness in this env | Add an integration test once a DB harness exists (prompt-06 DB audit) |
| FIX-008/009/011..016 | fix-ready §4 Batch C | PD-gated or cross-module | Batch C per fix-ready plan |

## C.10 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-007 gateway-refund-API call | `[NEEDS PRODUCT DECISION]` Q-PD6 + `[SHARED DEPENDENCY]` | V1 scope undecided; needs billing connected-account refund surface | Answer Q-PD6; verify billing refund surface (Batch E) |
| Partial-refund expiry-reversal direction | `[NEEDS PRODUCT DECISION]` Q-PD2 | BR-08 ambiguous on whether partial refunds reverse expiry | Answer Q-PD2 |

## C.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-007 gateway refund call | `[NEEDS PRODUCT DECISION Q-PD6]` | Out of scope this pass (ledger-only cap + eligibility shipped) |
| Partial-refund expiry direction change | `[NEEDS PRODUCT DECISION Q-PD2]` | Gated; current behavior preserved + test-locked |
| FIX-008 dunning / FIX-009 funnel / FIX-011 timeout / FIX-012..016 | V2/Batch C | Out of scope; PD-gated or cross-module |

## C.12 Files Changed (this pass)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/duesspecialassessments/refundDuesPayment.ts` | Wire `validateRefundEligibility` (over-refund cap + status + 30-day window); cap to remaining; cumulative-correct `isFullRefund` | FIX-007 |
| `services/api-ts/src/handlers/member/duesspecialassessments/confirmPaymentProof.ts` | Wrap settle + status + invoice markPaid in one `db.transaction`; remove bare `catch {}` (invoice failures now propagate) | FIX-010 |
| `services/api-ts/src/handlers/member/duesspecialassessments/updateDuesConfig.ts` | Cross-org tenant guard (`ForbiddenError` on org mismatch) | config tenant guard |
| `services/api-ts/src/handlers/member/duesspecialassessments/deleteDuesConfig.ts` | Cross-org tenant guard (`ForbiddenError` on org mismatch) | config tenant guard |
| `services/api-ts/src/handlers/member/duesspecialassessments/refundDuesPayment.test.ts` | +4 FIX-007 cases (over-refund, within-remaining/cumulative-full, out-of-window, Q-PD2 partial boundary); fixture `paidAt` | FIX-007 |
| `services/api-ts/src/handlers/member/duesspecialassessments/dues-mutation-auth.test.ts` | FIX-002 own-org refund fixture `paidAt` (so eligibility passes; org-guard regression preserved) | FIX-007 (regression) |
| `services/api-ts/src/handlers/member/duesspecialassessments/confirmPaymentProof.test.ts` (new) | Happy-path + in-transaction + invoice-failure-rollback tests | FIX-010 |
| `services/api-ts/src/handlers/member/duesspecialassessments/dues-config-tenant-guard.test.ts` (new) | Cross-org update/delete config tenant-guard tests | config tenant guard |

## C.13 Completion Decision

`COMPLETE`

The settle-seam pass (FIX-007 over-refund cap + `validateRefundEligibility` wiring, FIX-010 `confirmPaymentProof` transaction atomicity, and the `updateDuesConfig`/`deleteDuesConfig` cross-org tenant guard) was implemented test-first (RED confirmed for the right reason → minimal GREEN), with no weakened assertions and explicit membership-status side-effect assertions. Focused (31/31), dues module (312/312), cross-module membership + domain-event-consumers (675/675), and full api-ts (6263 pass / 1 pre-existing unrelated fail / 4 todo) tests pass; monorepo typecheck 5/5. Product-decision gates were respected: the FIX-007 **gateway-refund-API call** (Q-PD6) was NOT touched, and the **partial-refund expiry-reversal direction** (Q-PD2) was left unchanged and locked by a boundary test. No schema/migration, no forbidden git commands, dirty working tree preserved.

## C.14 Recommended Next Step

This completes the dues settle-seam carry-forward. Remaining dues work is product-decision-gated (Batch C: FIX-007 gateway call/Q-PD6, FIX-008/009/011..016) — do not start without the §8 decisions.

- For dues: `request product decision` for Q-PD2/Q-PD6/Q-PD7/Q-PD8 before any Batch C `04` pass.
- Otherwise proceed to the next module/group per the remaining-work sequence (e.g. Training Batch E) via `docs/aha/prompts/04-module-or-group-fix-tdd.md`.

---

# AHA Module/Group Fix Report: Dues & Payments — **Step 45: member-payment funnel** (FIX-009 / Q-PD7 + Q-PD8)

> Appended 2026-06-13. Batch A, Batch B subset, and the settle-seam pass (above) are unchanged. This section covers **FIX-009** — the join→pay→active funnel that was broken end-to-end: an approved member sits `pendingPayment` with **no first invoice** (the batch generator filters `status='active'` only) and the cross-org `My Payments` page dead-ended at history with **no reachable "Pay Now"**. Pass id: `dues-funnel`. Resolves the two §8 gates **Q-PD7** and **Q-PD8**; **Q-PD6** (gateway-API refund) stays env-deferred.

## D.1 Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dues & Payments |
| Module slug | dues-payments |
| Raw gap plan used | `docs/aha/module-gap-plans/dues-payments-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md` (§3 FIX-009; §4 Batch C; §8 Q-PD7/Q-PD8) |
| Output fix report | `docs/aha/module-fix-plans/dues-payments-fix-report.md` (this file, appended) |
| Fix date | 2026-06-13 |
| Batch executed | Funnel slice — FIX-009 (Q-PD7 first-invoice-on-approval + Q-PD8 member Pay Now entry) |
| Decisions captured | **Q-PD7 = (a) Event consumer** on the existing `membership.created` domain event. **Q-PD8 = (a) Self-serve** Pay Now, reusing the already-shipped org-dues proof-submit flow + a new reachable CTA on `My Payments`. Both = the engineering recommendation (user selected the recommended option for each via `AskUserQuestion`). |
| Superpowers used | Yes (`superpowers:using-superpowers` / TDD discipline — RED→GREEN per slice; anti-fake-green). |
| Working tree status checked | Yes (intentionally dirty from prior AHA passes — preserved; only the 2 new backend files + 1 consumer edit + 2 new FE files + 1 page edit are this pass's. No forbidden git commands.) |
| Fix scope | P1 / V1 REQUIRED — FIX-009 (first-invoice trigger + member pay entry) |
| Out of scope | Q-PD6 gateway-API refund (env-blocked: stripe-mock not in CI), emailed tokenized pay links (Q-PD8 option (b) — V2 additive), FIX-008/011..016, settle/refund math, the double-expiry consumer path |
| Shared files touched | Yes — `core/domain-event-consumers.ts` (added ONE `membership.created` subscriber; existing subscribers untouched). No TypeSpec/generated, no SDK. |
| Schema/migration touched | No (reused existing `dues_invoice` / `dues_config` tables) |
| Limitations | All tests are mock-based (no real-DB harness in this env). E2E browser proof is `[BLOCKED BY ENVIRONMENT]` (`:3004` redirects to `/auth/sign-in`, no seeded authed member) — proven via the backend helper + consumer-wiring nets and the FE component net instead. Period derivation uses the config `cycleStartMonth`; an annual cycle is assumed (consistent with `annualAmount`). |

## D.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-009 (Q-PD7) | No first invoice on approval: `approveMembershipApplication` leaves the member `pendingPayment`; `generateDuesInvoicesForOrg` filters `status='active'` → a newly-approved member never gets a payable invoice | P1 | V1 REQUIRED | C (funnel sub-pass) | Pilot's core value ("stay current on dues from any device") dead-ends at join; the approval handler already emits `membership.created` post-commit, so an event consumer is the clean, decoupled seam | Fixed |
| FIX-009 (Q-PD8) | No reachable member pay entry on `My Payments` (`/my/payments` dead-ends at history) | P1 | V1 REQUIRED | C (funnel sub-pass) | The org dues page already implements self-serve proof-submit; the cross-org payments surface had no path to it | Fixed |

## D.3 Baseline Before Changes (RED, watched fail first)

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `firstInvoiceOnApproval.test.ts` (new helper unit) | RED — `Cannot find module './firstInvoiceOnApproval'` | FIX-009 / Q-PD7 | Confirmed RED: the first-invoice seam did not exist. |
| `firstInvoiceOnApproval.test.ts` (consumer-wiring through the bus) | RED (same module-missing) | FIX-009 / Q-PD7 | No `membership.created → dues invoice` subscriber existed (only welcome-notif + comms auto-join). |
| `pay-dues-cta.test.tsx` (new FE component) | RED — `Cannot find module './pay-dues-cta'` | FIX-009 / Q-PD8 | Confirmed RED: no member Pay Now CTA component. |

## D.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| Q-PD7 | New `mintFirstDuesInvoice(db, payload, logger, now)` helper: loads the membership, **defensively guards org isolation** (payload org must equal membership org), resolves the org's **active, tier-matched** dues config (falls back to any active org config), derives the annual period from `cycleStartMonth`, and mints ONE invoice — **idempotent per (membership, period)** (mirrors the batch generator's guard). `computeDuesPeriod` exported + unit-tested. | `member/duesspecialassessments/firstInvoiceOnApproval.ts` (new) | No (raw drizzle on existing `memberships`/`dues_config`/`dues_invoice`) | Read-only on `memberships` — **does NOT change the status transition** (approval stays `pendingPayment`; settle still flips to `active`, per ratified Track B). |
| Q-PD7 (wiring) | Added ONE `domainEvents.on('membership.created', …)` subscriber that calls the helper and, on success, emits `dues.invoice.generated` so the existing consumer notifies the member of their new invoice. Fire-and-forget with its own try/catch + structured log (mirrors the cascade subscribers). | `core/domain-event-consumers.ts` | `[SHARED DEPENDENCY]` (added a subscriber; existing `membership.created` subscribers untouched) | `[CROSS-MODULE RISK]` handled: the consumer never writes membership status; the helper's org guard prevents an org-A approval minting an org-B invoice. |
| Q-PD8 | New presentational `PayDuesCta` (shows outstanding-invoice count + amount, routes to `/org/$orgSlug/dues#pay-dues-section` — the org dues page's already-shipped self-serve proof-submit flow). Renders nothing when no open invoice or no org context. Mounted on `my/payments.tsx`, which now resolves the member's open invoices (member role self-scopes per FIX-006) + org slug via `useMyOrgs`. | `features/dues/components/pay-dues-cta.tsx` (new), `routes/_authenticated/my/payments.tsx` | No | Reuses the shipped proof flow (`ProofUploadForm`, atomic per FIX-010) — **no new gateway dependency, no emailed-link/token route**. `sonner` not needed (navigation only). |

## D.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `member/duesspecialassessments/firstInvoiceOnApproval.test.ts` (new) | backend/unit + integration (event bus) | Helper mints exactly one invoice from the config amount/fund-split; **idempotent** per period; **org-mismatch → mints nothing**; no-config/no-membership → skip; **tier-matched** config chosen; **no membership-status mutation**. Bus wiring: emitting `membership.created` mints one `dues_invoice` and never updates `memberships`; a foreign-org event mints nothing. | FIX-009 / Q-PD7 |
| `features/dues/components/pay-dues-cta.test.tsx` (new) | frontend/component | CTA renders a Pay Now link to `/org/{slug}/dues` when an open invoice exists; renders nothing when count is 0 or no org context; surfaces the unpaid count. | FIX-009 / Q-PD8 |

## D.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test …/firstInvoiceOnApproval.test.ts` (pre-impl) | Failed (module missing) | RED confirmed for Q-PD7 (helper + wiring). |
| `bun test …/pay-dues-cta.test.tsx` (pre-impl) | Failed (module missing) | RED confirmed for Q-PD8. |
| `bun test …/firstInvoiceOnApproval.test.ts` (post) | Passed (11/11, 35 expect) | Helper + consumer-wiring RED→GREEN. |
| `bun test …/pay-dues-cta.test.tsx` (post) | Passed (4/4) | Q-PD8 RED→GREEN. |
| `bun test src/handlers/member/duesspecialassessments/ src/core/domain-event-consumers.test.ts src/handlers/member/membership/` | Passed (1004/1004 across 81 files) | Dues module + domain-event consumers + **membership cross-module seam** — no regression, no status drift. |
| `bun test …/pay-dues-cta.test.tsx …/payment-history-table.test.tsx` | Passed (4/4) | FE no-regression on the touched page's table. |
| `cd services/api-ts && bunx tsc --noEmit` | Passed (exit 0) | Clean. |
| `cd apps/memberry && bunx tsc --noEmit` | Passed (exit 0) | Clean. |
| Live E2E browser proof | Not Run / Blocked | `[BLOCKED BY ENVIRONMENT]` — `:3004` redirects to `/auth/sign-in`, no seeded authed member; proven via handler + consumer + component nets. |

## D.7 Validation Summary

- **Passed:** Both decisions implemented test-first (RED watched failing for the right reason → minimal GREEN), no weakened assertions. 11/11 backend funnel + bus-wiring; 4/4 FE CTA; 1004/1004 dues + consumers + membership seam (cross-module clean, no status regression); typecheck clean in both touched workspaces.
- **Failed:** None.
- **Pre-existing / unrelated:** The single known `email/jobs/index.test.ts` failure was not in the run scope; a benign `pg` DeprecationWarning prints during the membership-seam suite (not a failure).
- **Not run / blocked:** Live authed browser E2E (`[BLOCKED BY ENVIRONMENT]`). Q-PD6 gateway-API refund (env-blocked: stripe-mock not in CI) — **not touched**.

## D.8 Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Domain-event seam | `core/domain-event-consumers.ts` (+1 `membership.created` subscriber) | All `membership.created` emitters (approval funnel, claimInvite) now also mint a first invoice | `firstInvoiceOnApproval.test.ts` bus-wiring; `domain-event-consumers.test.ts` (1004-suite) green | `[SHARED DEPENDENCY]` — additive subscriber; existing welcome-notif + comms auto-join subscribers untouched. Idempotency prevents double-issue if a later batch run also fires. |
| Membership seam (read-only) | `memberships` (read only via helper) | Membership status lifecycle | Helper + bus tests assert **zero** `memberships` updates | `[CROSS-MODULE RISK]` — funnel does NOT alter the `pendingPayment → active` transition; only settle does. |

## D.9 Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Live authed E2E of the full funnel (approve → notification → org dues → proof upload → confirm → active) | FIX-009 | `[BLOCKED BY ENVIRONMENT]` no seeded authed member at `:3004` | Run a Playwright spec once a seeded member session exists (pin Playwright 1.58.2). |
| Emailed tokenized pay links in `reminderProcessor` | Q-PD8 option (b) | Decision was self-serve (a); links are additive V2 | Defer to V2 (additive, not blocking). |
| FIX-008 dunning / FIX-011 timeout / FIX-012..016 | fix-ready §4 Batch C | PD-gated or independent | Per fix-ready plan. |

## D.10 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Q-PD6 gateway-API refund execution | `[BLOCKED BY ENVIRONMENT]` + `[NEEDS PRODUCT DECISION]` | stripe-mock not wired into CI; ledger-only acceptable for pilot | Wire stripe-mock + verify billing connected-account refund surface (Batch E). |

## D.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Emailed tokenized pay links / link-target route | V2 DEFERRED | Q-PD8 = self-serve (a); links are additive V2. |
| Q-PD6 gateway refund call | `[BLOCKED BY ENVIRONMENT]` | stripe-mock not in CI; out of scope this pass. |

## D.12 Files Changed (this pass)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/member/duesspecialassessments/firstInvoiceOnApproval.ts` (new) | `mintFirstDuesInvoice` + `computeDuesPeriod` (idempotent, org-guarded, tier-matched first-invoice mint) | Q-PD7 |
| `services/api-ts/src/handlers/member/duesspecialassessments/firstInvoiceOnApproval.test.ts` (new) | Helper unit (9) + consumer-wiring through the bus (2) | Q-PD7 |
| `services/api-ts/src/core/domain-event-consumers.ts` | +1 `membership.created` subscriber → mint first invoice → emit `dues.invoice.generated` | Q-PD7 |
| `apps/memberry/src/features/dues/components/pay-dues-cta.tsx` (new) | Presentational member "Pay Now" CTA → org dues pay section | Q-PD8 |
| `apps/memberry/src/features/dues/components/pay-dues-cta.test.tsx` (new) | CTA visibility + link-target tests | Q-PD8 |
| `apps/memberry/src/routes/_authenticated/my/payments.tsx` | Resolve open invoices + org slug; mount `PayDuesCta` | Q-PD8 |

## D.13 Completion Decision

`COMPLETE`

FIX-009 (the member-payment funnel) is closed: **Q-PD7** mints the first dues invoice on `membership.created` via a decoupled, idempotent, org-guarded domain-event consumer (no membership-status regression), and **Q-PD8** gives the member a reachable self-serve "Pay Now" entry on `My Payments` that routes into the already-shipped, atomic proof-submit flow. Implemented test-first (RED confirmed for the right reason → minimal GREEN), no weakened assertions. Focused (11/11 backend, 4/4 FE), cross-module seam (1004/1004 dues + consumers + membership), and typecheck (both workspaces) all pass. Product-decision gate respected: **Q-PD6** gateway-API refund was NOT touched (env-blocked). Live authed E2E is `[BLOCKED BY ENVIRONMENT]`.

## D.14 Recommended Next Step

The dues member-payment funnel is closed. Remaining dues work is product-decision- or environment-gated (Q-PD6 gateway refund; FIX-008 dunning; FIX-011..016). Do not auto-chain. Per the remaining-work sequence, the next P1 gates (roadmap §13) are each their own `[NEEDS PRODUCT DECISION]` session: **person-profile Q-1/Q-4**, **training TC-DEC-01/02**, **platform-admin Q1/Q8**, **notifications Q3/Q1**, **realtime PD-2/PD-3**. Re-run `07-consolidate-roadmap.md` once a few land (and to clear the stale §13 P0 table).
