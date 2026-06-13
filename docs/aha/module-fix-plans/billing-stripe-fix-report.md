# AHA Module/Group Fix Report: Billing (Stripe)

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Billing (Stripe) |
| Module slug | billing-stripe |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/billing-stripe-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/billing-stripe-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/billing-stripe-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — P0 core-workflow / safety blockers (FIX-001, FIX-002) |
| Superpowers used | Yes (`superpowers:using-superpowers` invoked before implementation; TDD discipline, anti-fake-green, root-cause focus, scope containment) |
| Working tree status checked | Yes (`git status --short` at start) |
| Fix scope | P0 (FIX-001, FIX-002) only |
| Out of scope | All Batch B/C/F fixes (FIX-003..013); FIX-012/013 `[NEEDS CONFIRMATION]`; per-org config / capture-method / officer roles / default currency / dues-billing unification / domain events (`[NEEDS PRODUCT DECISION]`); full stripe-mock contract flow (`[BLOCKED BY ENVIRONMENT]`); all Do-Not-Build items |
| Shared files touched | Yes — `services/api-ts/src/core/billing.ts` (redaction only, `[SHARED DEPENDENCY]`) |
| Schema/migration touched | Yes — `billing.schema.ts` (2 expression indexes) + hand-written migration `0063_billing_webhook_metadata_indexes.sql` + `_journal.json` entry |
| Limitations | Static + unit-level only. No live Stripe / stripe-mock execution. The index migration SQL is standard additive PG DDL but was NOT applied against a live DB this pass (no guaranteed test DB; matches repo's hand-written-migration convention since `drizzle-kit generate` fails exit 127 here). Webhook tests use predicate-aware repo-method mocks (no live JSONB query). |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | Stripe secret key logged in plaintext at SDK init (`core/billing.ts:93-96`) | P0 | V1 REQUIRED | A | Live credential leaking to every log sink; one-line redaction, shared file, zero behavior change | Fixed |
| FIX-002 | Webhook→invoice correlation capped at `findAll()` `limit(500)` + in-memory JSONB filter; invoices past 500 silently never marked paid | P0 | V1 REQUIRED | A | Silent financial-integrity loss; replaced 5 scan sites with indexed JSONB lookups + expression-index migration | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test handleStripeWebhook.test.ts repos/billing.repo.test.ts` | 71 pass / 0 fail | FIX-002 | Green baseline; existing tests mocked `findAll`/select-chain and could not catch the 500-row cap |
| `core/billing.test.ts` (new) | Did not exist | FIX-001 | No `core/billing.ts` test existed; new RED test added |
| New FIX-001 RED test | Failed for the right reason — log payload contained `key: sk_test_...` (asserted secret absent) | FIX-001 | Confirms the leak before fixing |
| New FIX-002 RED repo tests (5) | Failed — `findByStripePaymentIntentId` / `findByStripeTransferId` not a function | FIX-002 | Confirms methods absent before fixing |
| `bun run typecheck` (post-fix) | Exit 0, 0 TS errors | both | No pre-existing TS errors surfaced from the dirty tree either |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Removed `key: this.config.secretKey` from the `stripe.initialize` log; now logs `hasSecretKey: Boolean(...)` + non-sensitive `stripeOptions` only | `services/api-ts/src/core/billing.ts` (~L93-99) | Yes `[SHARED DEPENDENCY]` | Redaction only. No consumer reads the logged field. Secret still passed to `new Stripe(...)` — only the log line changed |
| FIX-002 | Added `InvoiceRepository.findByStripePaymentIntentId(id): Invoice\|null` and `findByStripeTransferId(id): Invoice[]` (indexed JSONB `->>` predicates, mirroring `findByStripeAccountId`). Replaced all 5 `findAll()` scan sites in the webhook handler (3 PI sites, 2 transfer sites). Retired `findAll()` entirely | `repos/billing.repo.ts`, `handleStripeWebhook.ts` | No (module-local) `[CROSS-MODULE RISK]` on webhook | Webhook is a cross-module integration point (platformadmin subscription sync, booking invoice creation) — regression-tested green |
| FIX-002 | Added 2 expression indexes to schema + hand-written migration `0063_billing_webhook_metadata_indexes.sql` + journal entry idx 63 | `repos/billing.schema.ts`, `generated/migrations/0063_billing_webhook_metadata_indexes.sql`, `generated/migrations/meta/_journal.json` | No (module-local table `invoice`) | Hand-written per repo convention (drizzle-kit generate fails exit 127 here; documented in 0061/0062). Additive + idempotent (`CREATE INDEX IF NOT EXISTS`) |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/core/billing.test.ts` (new) | backend/unit + regression | The `stripe.initialize` log stream never contains the plaintext secret key (capturing-logger asserts secret absent) | FIX-001 |
| `repos/billing.repo.test.ts` (extended, +5 tests) | data/schema + regression | `findByStripePaymentIntentId` returns the matching invoice / null; `findByStripeTransferId` returns matching array / empty; methods exist (not a `findAll` wrapper) | FIX-002 |
| `handleStripeWebhook.test.ts` (updated) | backend/unit + regression | Webhook now correlates via predicate-aware `findByStripePaymentIntentId`/`findByStripeTransferId` prototype mocks (not `findAll`); added "marks invoice paid even when beyond the old 500-row scan window" (601-invoice fixture, target at position 601) | FIX-002 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/core/billing.test.ts` (RED) | Failed (expected) | Secret present in log — confirmed leak before fix |
| `bun test src/core/billing.test.ts` (GREEN) | Passed | 1 pass after redaction |
| `bun test repos/billing.repo.test.ts` (RED) | Failed (expected) | 5 fail — new methods absent |
| `bun test repos/billing.repo.test.ts` (GREEN) | Passed | 46 pass |
| `bun test handleStripeWebhook.test.ts` | Passed | 30 pass after mock + handler rewire |
| `bun test src/handlers/billing/ src/core/billing.test.ts` | Passed | 226 pass / 0 fail across 24 files (full billing module) |
| `bun test src/handlers/booking/ src/handlers/platformadmin/` | Passed | 631 pass / 0 fail (cross-module regression) |
| `bun run typecheck` (`tsc --noEmit`) | Passed | Exit 0, 0 TS errors |
| Live migration apply (`0063`) against DB | Not Run | No guaranteed test DB; SQL is standard additive idempotent PG DDL — `[BLOCKED BY ENVIRONMENT]` for live verification only |

## 7. Validation Summary

- **Passed:** FIX-001 regression test; FIX-002 repo + webhook tests; full billing module suite (226); cross-module booking + platformadmin regression (631); whole-project typecheck (0 errors).
- **Failed:** None after fixes. RED-phase failures were intentional and resolved.
- **Not run:** Live application of migration `0063` against a Postgres instance (no guaranteed DB this pass). Full stripe-mock pay→capture→refund contract flow (out of scope, `[BLOCKED BY ENVIRONMENT]`).
- **Blocked:** Live migration verification only — the SQL is additive, idempotent, and matches the repo's two prior hand-written migrations (0061/0062).
- **Pre-existing/unrelated:** The working tree carried prior-AHA dues/membership changes + migration `0062`. None were touched. Typecheck surfaced zero errors, including from those files.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| Shared billing service | `core/billing.ts` | dues `checkoutPaymentToken`, events `registerAndPayForEvent`, dues jobs, booking — all use `BillingService` | Billing module tests (226) green; typecheck green | `[SHARED DEPENDENCY]` — change is log-redaction only; no method signature or behavior change. No consumer reads the removed log field |
| Webhook handler | `handleStripeWebhook.ts` | platformadmin subscription sync; booking invoice creation (repo-to-repo `InvoiceRepository` import) | booking + platformadmin suites: 631 pass | `[CROSS-MODULE RISK]` — subscription handlers and booking invoice paths regression-tested green; their own dedupe path untouched |
| Invoice repo | `repos/billing.repo.ts` (new methods, `findAll` retired) | booking imports `InvoiceRepository` (does not use `findAll`); webhook only | booking suite green; grep confirms no other `InvoiceRepository.findAll` consumer | Retiring `findAll` is safe — only the webhook used it |
| Schema / migration | table `invoice`; `0063_billing_webhook_metadata_indexes.sql`; `_journal.json` | Module-local table only | Additive idempotent DDL; schema indexes documented as source-of-truth | `[NEEDS CONFIRMATION]` — live apply not run this pass (env); SQL is standard `CREATE INDEX IF NOT EXISTS ((metadata->>'key'))` |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| listInvoices foreign-merchant leak | FIX-003 | Batch B — out of scope this pass | Run a Batch B `04` pass |
| Webhook idempotency for invoice payment events | FIX-004 | Batch B | Batch B `04` pass |
| payInvoice status guard + failed-retry | FIX-005, FIX-006 | Batch B | Batch B `04` pass |
| updateInvoice transactional line-item replacement | FIX-007 | Batch B | Batch B `04` pass |
| Unpaid-invoice void path | FIX-008 | Batch B | Batch B `04` pass |
| Financial actor columns, cumulative partial refunds | FIX-009, FIX-010 | Batch C | Batch C `04` pass |
| Invoice-number race / per-org numbering | FIX-011 | Batch F | Batch F `04` pass |
| Live application of migration `0063` | FIX-002 (schema) | No guaranteed test DB this pass | Apply on next server boot / migration run and confirm both indexes created |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| `createInvoice` missing-org-context 400 (FIX-012) | `[NEEDS CONFIRMATION]` | Runtime 500 behavior + org-UUID mis-bind heuristic unconfirmed; held out of Batch A per plan §13 | Eng runtime check |
| `charge.refunded` `amount_refunded` vs `refunds.data` (FIX-013) | `[NEEDS CONFIRMATION]` | Stripe `2025-10-29.clover` payload shape unconfirmed | Verify against Stripe docs / stripe-mock |
| Full stripe-mock pay→capture→refund contract flow | `[BLOCKED BY ENVIRONMENT]` | stripe-mock not wired into CI (pilot-tier1 TODO) | Wire stripe-mock into CI |
| Live verification of `0063` indexes | `[BLOCKED BY ENVIRONMENT]` | No guaranteed Postgres instance this pass | Run migrations against a DB |
| Per-org billing config / capture-method / officer roles / default currency / dues-billing unification | `[NEEDS PRODUCT DECISION]` | Product model undecided | Founder/product decision |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| All Batch B/C/F fixes (FIX-003..011) | — | Not in selected Batch A |
| Platform fee, tax, recurring invoices, invoice UI | V2 DEFERRED | Explicitly deferred in plan §10 |
| Domain-event emission, dues-billing unification | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Product call, not a reliability blocker |
| Webhook DLQ/replay, multi-currency, gateway abstraction, org-owned merchant model | `[DO NOT OVERBUILD]` / DO NOT ADD | Plan §11 Do-Not-Build |
| Expanding subscription/transfer/PayMongo/`getPaymentIntent` | `[DO NOT OVERBUILD]` | Plan §11; left untouched |
| Doc staleness (m21 §6/§7, API_CONTRACTS, NAVIGATION_MAP, AC error codes, notification copy) | V1 RECOMMENDED (deferred) | Doc-only, zero reliability risk |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/core/billing.ts` | Redact secret key from `stripe.initialize` log (`hasSecretKey` boolean) | FIX-001 |
| `services/api-ts/src/core/billing.test.ts` (new) | Regression test: secret never logged on init | FIX-001 |
| `services/api-ts/src/handlers/billing/repos/billing.repo.ts` | Add `findByStripePaymentIntentId` + `findByStripeTransferId`; retire `findAll()` | FIX-002 |
| `services/api-ts/src/handlers/billing/repos/billing.repo.test.ts` | +5 tests for new indexed lookups | FIX-002 |
| `services/api-ts/src/handlers/billing/handleStripeWebhook.ts` | Replace 5 `findAll()` scan sites with indexed lookups; drop unused `InvoiceMetadata` import; update stale comment | FIX-002 |
| `services/api-ts/src/handlers/billing/handleStripeWebhook.test.ts` | Patch new repo methods in `buildApp`; add 601-invoice scale regression test | FIX-002 |
| `services/api-ts/src/handlers/billing/repos/billing.schema.ts` | Add 2 JSONB expression indexes (source-of-truth) + `sql` import | FIX-002 |
| `services/api-ts/src/generated/migrations/0063_billing_webhook_metadata_indexes.sql` (new) | Hand-written additive expression-index migration | FIX-002 |
| `services/api-ts/src/generated/migrations/meta/_journal.json` | Append idx 63 entry (preserves prior 0062) | FIX-002 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| FIX-001 RED output (secret present in log payload, then GREEN) | Inline in §3/§6 (test run transcripts) | FIX-001 |
| FIX-002 RED output (5 method-missing failures, then 46 GREEN) | Inline in §3/§6 | FIX-002 |
| Full billing suite 226 pass; booking+platformadmin 631 pass; typecheck exit 0 | Inline in §6/§7 | both |

## 14. Completion Decision

**COMPLETE**

Both selected Batch A P0 fixes were implemented test-first (RED confirmed for the correct reason, then GREEN), with regression coverage. FIX-001 redacts the plaintext Stripe secret key from logs (shared file, zero behavior change). FIX-002 replaces all 5 unbounded `findAll()` webhook scan sites with indexed JSONB lookups, retires `findAll()`, and ships a backing expression-index migration. Validation passed: full billing module (226), cross-module booking + platformadmin regression (631), and whole-project typecheck (0 errors). The only unverified item is the *live application* of migration `0063` (no guaranteed DB this pass) — the SQL is additive, idempotent, and matches the repo's established hand-written-migration pattern, so this is a low-risk environment limitation, not a code defect.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch B** (FIX-003..008 — listInvoices self-scoping, webhook idempotency, payInvoice status-guard + failed-retry, updateInvoice line-item replacement, unpaid-void).

- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Input fix-ready plan: `docs/aha/module-fix-plans/billing-stripe-fix-ready-plan.md`
- Selected batch: Batch B — P1 reliability / trust / permission gaps

Also: on the next API server boot / migration run, confirm migration `0063` applies and both `invoices_metadata_payment_intent_idx` and `invoices_metadata_transfer_idx` are created.

---

## Batch B Addendum — P1 reliability / trust / permission (2026-06-11)

> **Scope note:** the consolidated roadmap §8 order 7 labels this work
> "Dues & Payments — Batch B (listInvoices foreign-merchant leak, webhook
> idempotency, payInvoice status guard)". The defects and their fix-ready
> evidence live in the **billing** module, so the work was executed here against
> `billing-stripe-fix-ready-plan.md` §4 Batch B. Executed the three roadmap-named
> decision-free items (FIX-003, FIX-004, FIX-005) plus the conjoined FIX-006
> (failed-retry, same handler/region as FIX-005). FIX-007 (`updateInvoice`
> line-item replacement) and FIX-008 (unpaid-void) were **not** in the named
> §8-7 scope and remain deferred to a later Batch B pass.

### Batch executed

| Fix ID | Gap | Severity | Status |
| --- | --- | --- | --- |
| FIX-003 | `listInvoices` non-admin foreign `?merchant=` enumeration leak (guard only fired for `?customer=`) | P1 | Fixed |
| FIX-004 | No webhook idempotency for invoice payment events — Stripe redelivery double-notified + re-transitioned | P1 | Fixed |
| FIX-005 | `payInvoice` never checked `invoice.status` — draft/void/uncollectible/paid invoices were payable (BR-61) | P1 | Fixed |
| FIX-006 | Failed/canceled payment permanently 409'd the invoice (no retry) — contradicts m21 §1 | P1 | Fixed |

### TDD evidence (RED → GREEN)

RED first, confirmed failing for the correct reason, then minimal fix:
- FIX-003: `Non-admin passing a foreign ?merchant= filter is denied -> 403` — RED resolved 200 (leak), now rejects `ForbiddenError`.
- FIX-004: `duplicate payment_intent.succeeded … single transition + single notification` and `… charge.succeeded does not double-notify` — RED counted 2 updates / doubled notifications, now 1 update; plus `a distinct event.id … still processes` regression guard.
- FIX-005: `returns 422 when invoice.status is "draft|void|uncollectible|paid"` — RED returned 200, now 422 `INVOICE_NOT_PAYABLE`.
- FIX-006: `allows retry (200) when paymentStatus is "failed|canceled"` — RED returned 409, now 200; in-progress states (`requires_capture|processing|succeeded`) still 409.

### Changes made

| File | Change | Fix ID |
| --- | --- | --- |
| `handlers/billing/listInvoices.ts` | Added symmetric merchant-filter self-scope guard mirroring the existing customer guard (`merchant && merchant !== user.id && customer !== user.id → 403`) | FIX-003 |
| `handlers/billing/payInvoice.ts` | Added `status !== 'open' → BusinessLogicError('INVOICE_NOT_PAYABLE')` (422); narrowed the re-pay block to `['requires_capture','processing','succeeded']` so failed/canceled are retryable | FIX-005, FIX-006 |
| `handlers/billing/handleStripeWebhook.ts` | Added `lastStripeEventId` dedupe (read from / written to `invoice.metadata`) to the 5 invoice-fetching handlers: paymentIntentSucceeded, paymentIntentFailed, chargeSucceeded, chargeFailed, chargeRefunded — mirroring the subscription handlers' existing pattern | FIX-004 |
| `handlers/billing/accessControl.test.ts` | +4 FIX-003 tests (foreign merchant 403, foreign customer 403, admin allowed, merchant self+customer legit path) | FIX-003 |
| `handlers/billing/payInvoice.test.ts` | Split payment-state block into blocking (409) vs retryable (200); added BR-61 status-guard block | FIX-005, FIX-006 |
| `handlers/billing/handleStripeWebhook.test.ts` | +3 FIX-004 idempotency tests (stateful invoice + notify/update counters) | FIX-004 |

### Design notes

- **FIX-004 scope:** dedupe added to the 5 invoice handlers that fetch the invoice (and thus can read prior metadata) — these carry the non-idempotent side effects (customer/merchant notifications, refund-metadata accumulation). `handlePaymentIntentCanceled` and `handlePaymentIntentRequiresAction` do **not** fetch the invoice and only set a status field (`canceled`/`void`/`processing`), which is naturally idempotent (no notification, no accumulation); they were left unchanged to keep the fix minimal. The single-`lastStripeEventId` field matches the subscription pattern and strictly improves on the prior no-dedupe state (it cannot regress: previously *every* redelivery re-processed).
- **FIX-003:** the "pass both" escape is preserved — `merchant=self + customer=X` and `customer=self + merchant=Y` remain allowed; only an unanchored foreign filter is denied.

### Validation

- Targeted trio (`accessControl` + `payInvoice` + `handleStripeWebhook`): 78 pass / 0 fail.
- Full billing handler suite: **237 pass / 0 fail** (was 226 pre-Batch-B; +11 new tests).
- Platformadmin suite (webhook subscription-dedupe regression surface): **384 pass / 0 fail**.
- API typecheck: 0 errors.

### Remaining in this module's Batch B (not done this pass)

| Item | Fix ID | Reason |
| --- | --- | --- |
| `updateInvoice` transactional line-item replacement (AC-M21-002) | FIX-007 | Not in §8-7 named scope; needs a transactional repo method |
| Unpaid-invoice void path (SM-M21-INVOICE) | FIX-008 | Not in §8-7 named scope |

### Completion decision — Batch B (named subset)

**COMPLETE** for the roadmap §8-7 decision-free trio (FIX-003/004/005) + conjoined FIX-006. All four implemented test-first with RED→GREEN proof and no weakened assertions; full-module + cross-module regression green; typecheck clean. FIX-007/008 deferred.

---

## Batch B Remainder — FIX-007 + FIX-008 (2026-06-12)

> **Scope note:** completes the two billing Batch B items deferred from the
> 2026-06-11 addendum. Decision-free subset only. Executed `04` against
> `billing-stripe-fix-ready-plan.md` §4 Batch B (rows FIX-007, FIX-008) and §5
> Test-First rows. No new migration, no generator run (handler + repo logic on
> existing tables). Excluded by design: Batch C (FIX-009/010/012/013), Batch F
> (FIX-011 numbering), and Batch E (`core/billing.ts` capture-method change,
> `[NEEDS PRODUCT DECISION]`).

| Item | Details |
| --- | --- |
| Fix date | 2026-06-12 |
| Batch executed | Batch B remainder — FIX-007, FIX-008 |
| Superpowers used | Yes (`superpowers:test-driven-development` invoked; RED→GREEN per fix, no weakened/fake-green assertions) |
| Working tree status checked | Yes (`git status` reviewed at start; pre-existing ~245-file dirty AHA tree preserved; this pass = source + test ADDs/edits only, no deletes) |
| Shared files touched | No (module-local billing handlers + repo only; `core/billing.ts` untouched) |
| Schema/migration touched | No (logic on existing `invoice` / `invoice_line_item` tables) |

### Batch executed

| Fix ID | Gap | Severity | Status |
| --- | --- | --- | --- |
| FIX-007 | `updateInvoice` recomputed totals but never persisted replacement line-item rows → stored `total` drifts from stored rows (AC-M21-002) | P1 | Fixed |
| FIX-008 | Unpaid open/draft invoices could not be voided — `voidInvoice` required `paymentStatus === 'requires_capture'`, diverging from SM-M21-INVOICE (Draft/Open → Void) | P1 | Fixed |

### TDD evidence (RED → GREEN)

RED first, confirmed failing for the correct reason, then minimal fix:

- **FIX-007**
  - Repo RED: `InvoiceRepository.replaceLineItems` *"deletes old rows, inserts new rows, and updates totals in one transaction"* + *"throws when the invoice update returns no row"* → both failed `replaceLineItems is not a function` (method absent).
  - Handler RED: `updateInvoice` *"transactionally replaces line items so reloaded rows == request and total == sum of rows"* — stateful stub seeded with an OLD line-item row; the buggy `updateOneById` path left the rows stale, so the reloaded `lineItems` were `['OLD']` not `['A','B']` → assertion failed (rows/total mismatch the request).
  - GREEN: added transactional `InvoiceRepository.replaceLineItems(invoiceId, lineItemsData, invoiceUpdate)` (delete → insert → update invoice, all inside `this.db.transaction`, mirroring the existing `createWithLineItems` tx pattern); `updateInvoice.ts` now routes to it when `body.lineItems` is present (plain `updateOneById` otherwise). Repo 2/2 + handler test green.

- **FIX-008** (corrected tests, not weakened — explicitly expected per the pass prompt)
  - RED: new `voidInvoice` tests *"voids an unpaid open invoice (no held payment) without calling Stripe"* + *"voids a draft invoice (Draft → Void) without a payment"* → both failed with `PAYMENT_NOT_AUTHORIZED` (handler rejected the unpaid void).
  - **Flipped** `voidInvoice.test.ts` *"throws BusinessLogicError when payment is not in requires_capture state"* (it encoded the spec-divergent rejection of an unpaid open invoice as correct) → rewritten to assert a successful no-charge void.
  - **Flipped** `lifecycle.test.ts` *"Cannot void draft invoice -> requires_capture check fails"* → rewritten to *"Voids a draft invoice (Draft -> Void) without charge"* (Draft → Void is a valid SM-M21-INVOICE transition).
  - GREEN: `voidInvoice.ts` restructured — terminal guards (already-void/already-paid → 409) + an `INVOICE_NOT_VOIDABLE` guard (only Draft/Open), then a branch: `paymentStatus === 'requires_capture'` keeps the authorized-payment path intact (cancel Stripe PI → void), and the `else` branch performs the standard no-charge void (`status:'void'`, `voidedAt`) without any Stripe call. All void tests green.

### Changes made

| File | Change | Fix ID |
| --- | --- | --- |
| `handlers/billing/repos/billing.repo.ts` | Added transactional `replaceLineItems(invoiceId, lineItemsData, invoiceUpdate)`: `tx.delete` existing line items → `tx.insert` replacement rows → `tx.update` invoice totals/fields, all in one `this.db.transaction`; throws `InternalError` if the invoice update returns no row | FIX-007 |
| `handlers/billing/updateInvoice.ts` | When `body.lineItems` present, persist the replacement rows + recomputed `subtotal`/`tax`/`total` atomically via `replaceLineItems`; non-line-item updates keep the plain `updateOneById` path | FIX-007 |
| `handlers/billing/voidInvoice.ts` | Status-based void guards (SM-M21-INVOICE): terminal-state 409s, `INVOICE_NOT_VOIDABLE` for non-Draft/Open, `requires_capture` → existing Stripe-cancel path, else → standard no-charge void (`status:'void'`, `voidedAt`). Shared response builder after the branch | FIX-008 |
| `handlers/billing/repos/billing.repo.test.ts` | +2 `replaceLineItems` tests (transactional delete+insert+update; throws on missing invoice) | FIX-007 |
| `handlers/billing/updateInvoice.test.ts` | +1 stateful test proving reloaded rows == request rows and persisted total == sum of rows | FIX-007 |
| `handlers/billing/voidInvoice.test.ts` | Flipped the spec-divergent `requires_capture` rejection test; +2 unpaid-void tests (open no-charge / draft) asserting 200 + `status:'void'` + no Stripe cancel | FIX-008 |
| `handlers/billing/lifecycle.test.ts` | Flipped `Cannot void draft invoice` → `Voids a draft invoice (Draft -> Void) without charge` (200 + void) | FIX-008 |

### Design notes

- **FIX-007 — no new tx abstraction.** `replaceLineItems` reuses the existing `this.db.transaction(async (tx) => …)` pattern already used by `createWithLineItems`; line-item rows are bound to the invoice id, and `invoiceUpdate` carries the recomputed `subtotal`/`tax`/`total` plus `updatedBy` so the row swap and total recompute commit together. `invoice_line_item.organizationId` is left unset to match the existing create path (its backfill is `V2 DEFERRED` per fix-ready plan §10 — not pulled into scope).
- **FIX-008 — authorized-payment path untouched.** The `requires_capture` branch is byte-for-byte equivalent to the prior behavior (provider-decision guard, PI-missing guard, merchant-account + `stripeAccountId` guards, `cancelPaymentIntent`, then void with `paymentStatus:'canceled'` + `providerDecision:'void'` metadata). Only the *new* unpaid branch was added. The catch-wrapping of unknown Stripe errors (`INVOICE_VOID_ERROR`) is scoped to the Stripe branch only.
- **`voidedBy` deliberately NOT populated** in the new unpaid path — that is **FIX-009** (financial actor columns, Batch C), explicitly out of this subset. Keeping it out avoids a half-applied actor-column change and respects scope (Implementation Rule 14: do not implement deferred items even if easy). The unpaid void sets the status transition only (`status:'void'`, `voidedAt`).

### Validation

| Command | Result | Notes |
| --- | --- | --- |
| `bun test repos/billing.repo.test.ts updateInvoice.test.ts` (RED) | Failed (expected) | 3 fail: 2× `replaceLineItems` absent, 1× stale-rows mismatch |
| same (GREEN) | Passed | 52 pass / 0 fail |
| `bun test voidInvoice.test.ts` (RED) | Failed (expected) | 2 fail: unpaid void rejected `PAYMENT_NOT_AUTHORIZED` |
| same (GREEN) | Passed | 12 pass / 0 fail |
| `bun test src/handlers/billing` | Passed | **241 pass / 0 fail** across 23 files (was 237 pre-pass; +4 net new) |
| `bun test` (full api-ts) | Partially Passed | **6083 pass / 1 fail / 4 todo** — the 1 fail is the PRE-EXISTING, UNRELATED `registerEmailJobs > registers email.processor as interval job` (30000 vs 1000), present in the documented baseline; no new failures, +4 vs the 6079 baseline |
| `bun run --filter '*' typecheck` | Passed | 5/5 workspaces exit 0 (api-ts, sdk-ts, ui, admin, memberry) |

Cross-module surface (booking `InvoiceRepository` import, platformadmin subscription webhook dedupe) is covered by the full `bun test` run above and stayed green — neither consumes `replaceLineItems` nor `voidInvoice`.

### Files changed (this pass)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/billing/repos/billing.repo.ts` | Add transactional `replaceLineItems` | FIX-007 |
| `services/api-ts/src/handlers/billing/updateInvoice.ts` | Route line-item updates through `replaceLineItems` | FIX-007 |
| `services/api-ts/src/handlers/billing/voidInvoice.ts` | Status-based void guards + unpaid no-charge void branch | FIX-008 |
| `services/api-ts/src/handlers/billing/repos/billing.repo.test.ts` | +2 `replaceLineItems` tests | FIX-007 |
| `services/api-ts/src/handlers/billing/updateInvoice.test.ts` | +1 line-item-replacement persistence test | FIX-007 |
| `services/api-ts/src/handlers/billing/voidInvoice.test.ts` | Flip spec-divergent test; +2 unpaid-void tests | FIX-008 |
| `services/api-ts/src/handlers/billing/lifecycle.test.ts` | Flip draft-void test to Draft → Void success | FIX-008 |

### Remaining in this module (not done this pass — later batches)

| Item | Fix ID | Batch | Reason |
| --- | --- | --- | --- |
| Financial actor columns (`authorizedAt/authorizedBy/paidBy/voidedBy`) | FIX-009 | C | `[NEEDS CONFIRMATION]`-free but out of this subset; do as a consistent Batch C pass |
| Cumulative partial refunds | FIX-010 | C | Out of subset |
| `createInvoice` missing-org 400 | FIX-012 | C | `[NEEDS CONFIRMATION]` |
| `charge.refunded` `amount_refunded` sync | FIX-013 | C | `[NEEDS CONFIRMATION]` (Stripe payload shape) |
| Invoice-number race / per-org numbering | FIX-011 | F | Schema/migration |
| `core/billing.ts` capture-method behavior | (Batch E) | E | `[NEEDS PRODUCT DECISION]` |

### Completion decision — Batch B remainder

**COMPLETE.** FIX-007 and FIX-008 implemented test-first (RED confirmed for the correct reason, then GREEN), with the spec-divergent void tests corrected (not weakened) per the pass prompt. Full billing module (241), full api-ts suite (6083 pass; only the documented pre-existing email-job failure remains), and monorepo typecheck (0 errors) all green. No migration, no generator run, no shared/`core` files touched. With this pass, billing Batch B (FIX-003..008) is fully landed.

### Recommended next step

Per CONTINUE-10 §"Remaining-work sequence", proceed to **Track A → A5: Communications Batch B** (FIX-006 RBAC, FIX-007 tenant, FIX-008 stats + confirm DEC-COMMS-05 scoping) as the next decision-free `04` pass.

- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Module slug: `communications` (per its fix-ready plan)

Carry-forward (unchanged, slot anytime): the Auth/RBAC `officerAuthMiddleware` dead-triplet eng-confirm — see `auth-rbac-fix-report.md` § "Batch E + Batch B cleanup" → "Still open".

---

## Stripe Fee / Settlement Path — carry-forward scoping pass (2026-06-13)

**Pass type:** `04-module-or-group-fix-tdd.md` carry-forward — "billing-stripe Stripe-fee path" from `consolidated-remediation-roadmap.md` §18 (cross-module `04` carry-forwards) and §76/§171/§279 (TC-DEC-01 Stripe variant → billing-stripe `04`).
**Superpowers used:** No (the disciplined-scoping reasoning was sufficient from the fix-ready plan + raw gap plan + live code; no implementation was reached).
**Working tree status checked:** Yes (`git status --short` — pre-existing dirty billing files from Batches A/B preserved and untouched; no destructive git).
**Outcome:** **BLOCKED — no decision-free, buildable fee-path logic exists in scope.** No code changed, no test added, no migration, no generator run.

### What the "fee path" actually is (discovery)

There is **no `FIX-NNN` for the fee path in the active fix scope (§3) of the fix-ready plan.** The only fee item in the entire plan is in **§10 Deferred** and **§8 Product Decisions**:

| Plan location | Item | Classification |
| --- | --- | --- |
| §10 Deferred (row 1) | "Platform fee calculation (`platformAmount = 0`)" | **V2 DEFERRED** — "Explicitly deferred in code (`payInvoice.ts:132`); no V1 revenue requirement" |
| §8 / §9 | V1 payment model: single platform Stripe Connect via env **or** per-org credentials via `billing_config`? | `[NEEDS PRODUCT DECISION]` — "Founder/product decides before any per-org config work" |
| §9 (row 2) | Honor `paymentCaptureMethod` (automatic capture) in `createPaymentIntent` | `[NEEDS PRODUCT DECISION]` |

The training-credits Step 47 report (`training-credits-fix-report.md` §"AHA Step 47", 2026-06-13) confirms the same: **TC-DEC-01 was DECIDED in favor of proof-of-payment; the Stripe fee path was explicitly NOT taken** ("Stripe Connect option explicitly NOT taken… If Stripe is later wanted it is a coordinated billing-stripe `04`, mirroring `registerAndPayForEvent`. `[CROSS-MODULE RISK]`").

### Code ground-truth (re-located, lines verified 2026-06-13)

- `services/api-ts/src/handlers/billing/payInvoice.ts:132` — `const platformAmount = 0; // Deferred: platform fee calculation — billing v2. Tracked: GAP-BACKLOG.md`. The fee **value** is hardcoded 0; this is the only V1 caller setting the platform fee.
- `services/api-ts/src/core/billing.ts:258` & `:291` — `createPaymentIntent` already threads `application_fee_amount: data.platformFeeAmount` through both the Checkout Session and the raw PaymentIntent, on the connected account (`stripeAccount: data.connectedAccountId`). **The fee-passing infrastructure exists and works**; only the value and the Connect model are unresolved.
- `core/billing.ts` `createPaymentIntent` is consumed by **3 modules**: `handlers/billing/payInvoice.ts`, `handlers/member/duesspecialassessments/checkoutPaymentToken.ts`, and `handlers/association:operations/registerAndPayForEvent.ts` → any behavior change here is a `[SHARED DEPENDENCY]` / `[CROSS-MODULE RISK]` requiring dues + events regression. The fix-ready plan §14 explicitly orders: *"Do NOT make any capture-method or other behavior change to this service."*
- `docs/product/modules/m21-billing/MODULE_SPEC.md` (+ `API_CONTRACTS.md`, `NAVIGATION_MAP.md`) contain **zero platform-fee policy** — no fee %, no "who absorbs the fee", no settlement/refund-fee model. `grep -niE "platform fee|application.?fee|take.?rate|commission"` over `docs/product/modules/m21-billing/` returns nothing. The only commission reference platform-wide is in `m17-marketplace.md`, unrelated to billing.

### Why this is BLOCKED, not buildable (decision policy applied)

The prompt's decision policy says: if a fix needs a product decision, apply the plan's §8 "Recommended Action" default **without asking**. But for every fee/Connect decision the plan's recommended action is **"defer" / "founder/product decides"** — there is **no recommended fee value, fee %, or Connect model to default to**. The two candidate sub-fixes both fail the decision-free + buildable test:

| Candidate sub-fix | Blocker |
| --- | --- |
| Set a real fee value (`platformAmount = 0` → N) | `[BLOCKED BY MISSING SPEC]` (m21 has no fee policy) + `[NEEDS PRODUCT DECISION]` (fee %, who absorbs, refund-fee netting). Inventing a % violates AHA §5.2 "do not invent features" + the explicit V2 deferral. |
| Defensively omit `application_fee_amount` when 0 / fix Connect wiring | Entangled with the unresolved V1 Connect model (single-platform-Connect vs per-org `billing_config`, §8/§9) and `transfer_data[destination]` semantics; touches the shared `core/billing.ts` service the plan explicitly bars from behavior change in this scope (`[SHARED DEPENDENCY]` → dues + events regression). |

Stripe docs confirm `application_fee_amount` is a documented **positive-integer** platform fee on a destination charge (`docs.stripe.com/connect/destination-charges`) — so the value/Connect wiring genuinely matters and cannot be guessed. There is no slice of the fee path that is simultaneously (a) decision-free, (b) spec-backed, and (c) inside the plan's allowed scope.

This is **not** a live-Stripe environment block (a Stripe stub would not unblock it — the missing input is a *product fee policy*, not a running gateway). stripe-mock CI wiring (ENV-BILL-01) is a separate, additional block on the full pay→capture→refund **contract** tests, not on this logic.

### Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Status |
| --- | --- | --- | --- | --- |
| (fee path) | Platform application-fee value / Stripe-Connect settlement model | — (V2 DEFERRED) | V2 DEFERRED + `[NEEDS PRODUCT DECISION]` + `[BLOCKED BY MISSING SPEC]` | Blocked |

### Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Platform fee value (`platformAmount`) | `[BLOCKED BY MISSING SPEC]` + `[NEEDS PRODUCT DECISION]` | No fee %/absorption/refund-netting policy in m21 or any product doc; V2 DEFERRED in plan §10 | Founder/product authors a fee policy (%, who absorbs, refund-fee netting) into m21-billing spec |
| V1 Stripe-Connect / settlement model (`application_fee_amount` + `transfer_data` wiring in `core/billing.ts`) | `[NEEDS PRODUCT DECISION]` + `[SHARED DEPENDENCY]` | Single-platform-Connect-via-env vs per-org `billing_config` undecided (plan §8/§9); shared service consumed by dues + events | Product decides the V1 Connect model; then a coordinated `04` with dues + events regression |
| TC-DEC-01 Stripe variant for paid trainings | `[NEEDS PRODUCT DECISION]` | TC-DEC-01 was already DECIDED as proof-of-payment (Step 47); Stripe is the explicitly-not-taken alternative — reversing it is a new product decision | Product decides to add a Stripe rail for paid trainings (would reverse Step 47's TC-DEC-01) |
| Full pay→capture→refund contract assertions | `[BLOCKED BY ENVIRONMENT]` | stripe-mock not wired into CI (ENV-BILL-01) | Wire stripe-mock into CI compose |

### Validation

No code/tests changed → no validation to run for this pass. Baseline billing suite remains green from the prior Batch-B-remainder pass (241 pass / full api-ts 6083 pass, documented pre-existing email-job failure only). Nothing in this scoping pass altered that.

### Completion decision — Stripe fee / settlement path

**BLOCKED.** The "Stripe-fee path" carry-forward has no decision-free, buildable, spec-backed logic inside the billing-stripe fix-ready plan's allowed scope. The fee **value** is V2-DEFERRED and gated on a missing fee policy (`[BLOCKED BY MISSING SPEC]`); the fee/settlement **wiring** is gated on the undecided V1 Stripe-Connect model (`[NEEDS PRODUCT DECISION]`) and lives in a shared service the plan bars from behavior change; the paid-training Stripe rail would reverse an already-made decision (TC-DEC-01 → proof-of-payment). Per AHA §5 (do not invent features) and §20 (do not implement items blocked by product decisions / missing specs), no fix was built. Reported honestly rather than fabricating a fee % or Connect model.

### Recommended next step

- **Request product decisions** (founder/product), in this order, before any future fee-path `04`:
  1. Author a **platform-fee policy** into `docs/product/modules/m21-billing/MODULE_SPEC.md` — fee % or formula, who absorbs it (member vs association), and refund-fee netting.
  2. Decide the **V1 Stripe-Connect model** — single platform Connect account via env, or per-org credentials via `billing_config` (`§8`).
- Once both are decided, run a **coordinated `04` pass** on `core/billing.ts` fee wiring **with dues (`checkoutPaymentToken`) + events (`registerAndPayForEvent`) regression** — `[SHARED DEPENDENCY]` / `[CROSS-MODULE RISK]`.
- Separately, wire **stripe-mock into CI** (ENV-BILL-01) to unblock the full pay→capture→refund contract tests.
- Meanwhile, the next **decision-free** billing-stripe `04` work is **Batch C** (FIX-009 actor columns, FIX-010 cumulative partial refunds) — gateway-independent, no product decision — and **Batch F** (FIX-011 invoice-number race). These are the productive next passes; the fee path is not.

---

## Platform Subscription Billing — re-scoped task 7 build (2026-06-13, CONTINUE-49)

### Founder decisions that unblocked this (locked CONTINUE-48 session)

The fee-path block above was a `[NEEDS PRODUCT DECISION]`. CONTINUE-48 resolved the *revenue model itself*, which re-scoped the task away from the blocked per-transaction skim:

- **Platform fee model = tiered SaaS subscription.** A `pricing_tier` covers up to `maxMembers` for a flat monthly/annual price; **the org pays the platform**. Tier prices are admin DATA (`createPricingTier`), not code. This is platform revenue.
- **Member-dues model = per-org direct charges.** Member dues are collected on each org's OWN Stripe account (org = merchant of record). The platform takes **NO `application_fee` / skim** on member dues. Therefore `payInvoice.ts platformAmount = 0` is **correct by design, NOT a gap** — the V2-DEFERRED/`[BLOCKED BY MISSING SPEC]` fee-policy block above is now **moot for V1** (it was only ever the skim model the founder did not choose). Org Stripe-Connect onboarding is a separate future item, not this task.
- **Refund-fee netting → N/A** (no per-transaction skim under this model).

### What was built (TDD RED→GREEN)

| Item | File(s) | Status |
| --- | --- | --- |
| `createSubscription` handler (org → tier), super-only RBAC (`requireAdminTier(SUPER_ONLY)`), unique-per-org 409, org-not-found 404 | `handlers/platformadmin/createSubscription.ts` | ✅ GREEN — TypeSpec-modeled (`specs/api/.../platform-admin-support.tsp`), generated route `routes.ts:307`, registry + SDK `createSubscriptionMutation` regenerated |
| Member-count → tier validation (pure helper): `maxMembers === null` ⇒ unlimited OK; else `activeMembers <= maxMembers` else 422; cheapest-covering-tier auto-pick when no `tierId` supplied | `handlers/platformadmin/utils/tier-fit.ts` (`tierFitsMemberCount`, `pickCheapestCoveringTier`) + `tier-fit.test.ts` | ✅ GREEN — billable headroom = memberships in `active`/`gracePeriod` |
| Stripe subscription wiring → populates `stripeSubscriptionId` | `createSubscription.ts` `provisionStripeSubscription` behind injectable `stripeBoundary.provision` | ✅ GREEN — **Stripe SDK STUBBED in tests** (Mock-Classification: APPROPRIATE — external gateway). Stub returns a fake `sub_…` id and the test asserts it persists. When Stripe is unconfigured (local/test) the row is persisted with `stripeSubscriptionId` null; non-fatal try/catch. Live call = `[BLOCKED BY ENVIRONMENT]`. |
| `past_due` transition on payment failure | `handlers/billing/handleStripeWebhook.ts` `handleInvoicePaymentFailed` (`invoice.payment_failed` → `past_due`, `lastStripeEventId` dedupe, no-match no-op) | ✅ GREEN |

### Fix applied this pass

The CONTINUE-49 verification run surfaced one RED in `handleStripeWebhook.test.ts` — the *"no-op when invoice has no matching platform subscription"* case. Root cause was a **test-mock dishonesty**, not a handler bug: the mock's `selectChain.limit` fell back to returning the full `allInvoices` fixture list when no subscription row was injected, so the handler's `if (!local) return` guard never fired (a real db returns `[]` on no match). Fixed the mock to return `[]` — **zero production code changed**. The handler logic was already correct.

### Validation (real counts)

```
bun test src/handlers/platformadmin/ src/handlers/billing/
  → 698 pass / 0 fail / 1208 expect() calls (78 files)
bun run --filter '*' typecheck
  → @monobase/ui, admin, @monobase/sdk-ts, @monobase/api-ts, memberry — all exit 0
```

No migrations needed (schema `pricingTiers` + `subscriptions` already had `maxMembers`/`trialDays`/`stripeSubscriptionId`/`stripeCustomerId`). Pre-existing unrelated `email/jobs/index.test.ts` `.env` interval failure ignored per scope.

### Not built (per locked decisions)

- Dropped `application_fee`/Connect skim on member dues (per-org direct charges, no skim — `platformAmount = 0` stays).
- Org Stripe-Connect onboarding flow (separate future item).
- Member-dues recurring-billing changes (m21 §1 out-of-scope).
