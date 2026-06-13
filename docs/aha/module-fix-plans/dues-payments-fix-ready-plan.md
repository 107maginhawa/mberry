# AHA Fix-Ready Plan: Dues & Payments

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dues & Payments |
| Module slug | dues-payments |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/dues-payments-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md` |
| Audit decision | FAIL (3 P0 + 7 P1; carried verbatim from gap plan §24) |
| Superpowers used | No — organizing was tractable from the gap plan + targeted source clarification; no Superpowers agent invoked. Documented here per shared rules §12. |
| Organizer decision | PARTIALLY READY |
| Reason | Batch A (P0) and Batch B (P1 RBAC/validation/privacy) are fully fix-ready with concrete evidence and existing patterns/utils to copy. Batch C (P1 workflow: dunning, funnel, gateway refund) and several P2 items are gated on product decisions (token expiry, partial-refund expiry, first-invoice trigger, PayMongo-V1, gateway-refund-V1, no-funds default) and one cross-module/role confirmation (`association:admin` grant). The module is not READY end-to-end until those answers land, but the highest-severity, highest-evidence work can start immediately. |
| Limitations | Gap plan was static review only — no server boot, no live webhook replay, no Playwright execution. Exact runtime error of the broken webhook→settlement seam is `[NEEDS CONFIRMATION]` (static evidence conclusive, runtime trace not captured). `association:admin` role grant site not traced — it changes the *true* blast radius (not the validity) of the missing position checks. Receipt-numbering fix almost certainly requires a DB migration (counter table or per-org unique), which this organizer flags into an isolated Batch F. Organizer did not re-audit; all findings carried from the gap plan. |

## 2. Fix Strategy Summary

**Fix first (Batch A — P0, do in current `04` pass):** the three financial-integrity blockers that make this a FAIL.
1. Online payment never lands in the ledger (webhook→settlement metadata seam): real money charged at Stripe, no `DuesPayment` row, no receipt, invoice never marked paid, webhook dead-letters on the fund-allocation FK insert. This is the flagship WF-038 flow and the single most important fix; its current tests are fake-green (synthetic metadata).
2. Cross-org refund possible — `refundDuesPayment` lacks the tenant guard every sibling mutation has. Tiny code change, large risk.
3. Cross-org receipt-number collision — hardcoded `'ORG'` prefix + global-unique constraint + per-org count sequence; breaks manual recording in any multi-org deployment (the platform's main mode). The schema change for this is isolated into Batch F.

**Then (Batch B — P1 RBAC/validation/privacy, mostly mechanical):** add `x-require-position` (Treasurer/President) to the ~10 ungated financial mutations, wire the existing `validateFundSplits` into `upsertDuesFunds`, self-scope `listDuesInvoices` for non-officers (copy the PAY-02 pattern), and cap refunds at remaining + wire `validateRefundEligibility`. All have existing patterns/utils to copy — low risk, test-first.

**Then, after product decisions (Batch C — P1 workflow):** implement `runDunning` using the already-written `dunning-escalation.ts`, first-invoice-on-approval + reminder payment links, and gateway-API refund execution. Each is blocked on a product/eng decision (§8) and/or crosses into membership/comms/billing modules.

**Test hardening (Batch D):** the RED tests in §5 are the gating artifacts — write the failing webhook-integration test, cross-org refund test, two-org receipt test, and RBAC matrix test before any code in their respective batches.

**Shared/DB isolation:** the receipt-counter migration is isolated to **Batch F (database/schema)**; the gateway-refund billing-API dependency and the `core/domain-event-consumers.ts` double-expiry seam are isolated to **Batch E (shared/platform)**. These are never buried inside module-local batches.

**Major risks:** (a) `settle-payment.ts` / `membership-lifecycle.ts` is a load-bearing cross-module seam — any settle/refund/expiry change has membership blast radius `[CROSS-MODULE RISK]`; (b) expiry is updated both inline in settle and via the event consumer — do not double-fix; (c) the receipt-numbering fix needs careful sequencing with seeds that import dues schemas via shims.

**Do not fix in this pass:** anything in gap plan §23 (V2/Do-Not-Add), PayMongo wiring until Q-PD5 answered, token-expiry change until Q-PD1 answered, the 5 unregistered helper handlers as public endpoints (salvage or delete only).

## 3. Active Fix Scope

Only P0 / P1 / selected P2 (workflow completeness) / V1 REQUIRED / selected V1 RECOMMENDED.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | Online payment never recorded in ledger: token checkout creates no `DuesPayment` row; webhook expects `metadata.paymentId`, falls back to `pi_...` non-UUID → fund-allocation FK insert fails → dead-letter; invoice never marked paid; no receipt | P0 | V1 REQUIRED | A (+ F for any schema) | Flagship WF-038 takes real money with zero financial record; AC-M06-001/002 + BR-06/07 chain broken; tests fake-green | `checkoutPaymentToken.ts:73-78`, `jobs/processStripePayment.ts:42-78`; no `createPayment` in flow; `stripeWebhook.test.ts:34`, `stripeWebhook.integration.test.ts:111-114` (synthetic metadata) |
| FIX-002 | `refundDuesPayment` missing cross-org ownership guard — Treasurer of org A can refund + reverse expiry of org B payments by id | P0 | V1 REQUIRED | A | Tenant-isolation + financial-integrity breach; `getPayment` unscoped | `refundDuesPayment.ts` (no `payment.organizationId !== orgId`) vs `confirmPaymentProof.ts:47`, `markDuesInvoicePaid.ts:37`; `dues-payments.repo.ts:174-181` |
| FIX-003 | Cross-org receipt-number collision: all 3 call sites hardcode `'ORG'` prefix; global-unique constraint + per-org count sequence ⇒ second org's first payment of year fails; count sequence also races within one org | P0 | V1 REQUIRED | A + F | Blocks WF-044 manual recording in multi-org mode (platform's main deployment) | `recordDuesPayment.ts:43`, `submitPaymentProof.ts:65`, `initiateOnlinePayment.ts:52`; `dues-payments.repo.ts:244-254`; schema `dues_payment_receipt_unique` (global) |
| FIX-004 | ~10 financial mutations missing Treasurer/President + 2FA gate (`updateDuesConfig`, `deleteDuesConfig`, `upsertDuesGatewayConfig`, `disconnectDuesGateway`, `testDuesGatewayConnection`, `upsertDuesFunds`, `runDunning`, `createDunningTemplate` + update/delete dunning template, `recalculateAgingBucket`) | P1 | V1 REQUIRED | B | Gateway credentials / dues amounts / fund splits mutable by any `association:admin` org member; violates ROLE_PERMISSION_MATRIX §3.4 | gap §14; `routes.ts:1124-1151,1315-1350` (no `requirePositionMiddleware`); `dues-mutation-auth.test.ts` covers only record/confirm/reject |
| FIX-005 | `upsertDuesFunds` performs zero server-side validation — fund percentages need not sum to 100; silent mis-allocation; only client-side check exists | P1 | V1 REQUIRED | B | BR-05 violated server-side; corrupts every later payment allocation; util already exists | `upsertDuesFunds.ts` (no `validateFundSplits` call); `fund-math.ts:validateFundSplits`; `funds.tsx:79` client-only |
| FIX-006 | `listDuesInvoices` returns ALL org invoices + person names + amounts to any member (no officer check / self-scope) | P1 | V1 REQUIRED | B | Org-wide financial-privacy leak; `listDuesPayments` already self-scopes (PAY-02) | `listDuesInvoices.ts:30-46` vs `listDuesPayments.ts:26-31`; route roles `routes.ts:1182` |
| FIX-007 | Refund unguarded against over-refund (repeated partials can exceed paid); gateway refund API never called; `refund-validation.ts` util unwired | P1 | V1 REQUIRED (over-refund cap) / V1 REQUIRED gateway-call `[NEEDS PRODUCT DECISION Q-PD6]` | B (cap + eligibility) / C+E (gateway call) | Books can show refunds exceeding receipts; gateway-paid money not actually returned | `refundDuesPayment.ts:43-46` (`refundAmount` unchecked vs remaining); `refund-validation.ts` no consumers; spec §15 |
| FIX-008 | Dunning escalation is a stub — `runDunning` always returns `sent: 0` ("Future:" comment); `dunning-escalation.ts` unwired; no dunning cron; `dunning.escalation` event never emitted | P1 | V1 RECOMMENDED | C | Treasurer runs dunning, sees success-shaped response, nothing sent — misleading journey/trust gap; logic already written | `runDunning.ts:40-52`; `dunning-escalation.ts` no production callers; `jobs/index.ts` registers only reminder + webhook-retry crons; `notification-triggers.ts:137` orphaned |
| FIX-009 ✅ **RESOLVED (2026-06-13, Step 45)** — Q-PD7 (a) event consumer mints first invoice on `membership.created`; Q-PD8 (a) self-serve Pay Now CTA on `My Payments` + shipped org-dues proof flow. See fix-report §D. (Emailed pay links = V2; Q-PD6 gateway refund still env-deferred.) | No reachable member payment entry point + no first invoice on MembershipApproved: reminders carry no pay link; no dashboard "Pay Now"; approval sets `pendingPayment`, batch generator filters `status='active'` only | P1 | V1 REQUIRED | C | Join→pay→active funnel requires manual officer action per member; new members stuck `pendingPayment` | `reminderProcessor.ts` (no token minting); no CTA in `org/$orgSlug/dues.tsx` / `my/payments.tsx`; `approveMembershipApplication.ts:66`; `generateDuesInvoicesForOrg.ts:75` `[CROSS-MODULE RISK]` `[NEEDS PRODUCT DECISION Q-PD7]` |
| FIX-010 | `confirmPaymentProof` settles OUTSIDE any transaction before the status update; failure between leaves expiry extended with payment stuck `submitted`; invoice markPaid failures swallowed by bare `catch {}` | P2 | V1 REQUIRED (data-integrity on a working flow) | B | Proof flow is a fully-working V1 path (PH bank transfer); partial-failure corrupts financial state silently | `confirmPaymentProof.ts:55-83` (no `db.transaction`, bare `catch {}`) |
| FIX-011 | 24h `pending → expired` timeout never set; treasurer never notified; `expired_at` column never written | P2 | V1 RECOMMENDED | C (after FIX-001) | Pending online payments hang forever; WF-038 exception path + §15 unmet | enum-only usage of `'expired'`; no timeout job; depends on FIX-001 creating pending rows |
| FIX-012 | Duplicate-recording warning returned only AFTER payment creation; frontend ignores `meta.concurrentWarning` | P2 | V1 RECOMMENDED | C | AC-M06-004 "proceeds only if confirmed" unmet; convention-desk double-entry risk | `recordDuesPayment.ts:37,122`; `record-payment-form.tsx` (no reference) |
| FIX-013 | Webhook idempotency keyed on Stripe `event.id`, not payment-intent / `gateway_transaction_id`; settlement not idempotent per intent → distinct events for same intent double-settle (double expiry + duplicate allocations) | P2 | V1 RECOMMENDED | C (with FIX-001) | Double money-effect on retry/duplicate delivery; financial correctness | `stripeWebhook.ts:29` (`idempotencyKey: event.id`); `processStripePayment.ts` settle not idempotent |
| FIX-014 | Life-member payment block missing everywhere (checkout, sendPaymentLink, recordDuesPayment) | P2 | V1 RECOMMENDED | C | AC-M06-007 unmet; life members (2099 expiry) can be charged | grep `life|2099` over module: zero hits |
| FIX-015 | Partial-refund per-allocation `Math.round(amount*ratio)` reversal can drift (centavo leak across funds) | P2 | V1 RECOMMENDED | C | Violates allocation-invariant spirit on reversals; reuse `allocateFunds` last-fund-absorbs | `membership-lifecycle.ts:193-201` (partial-refund expiry reversal itself is `[NEEDS PRODUCT DECISION Q-PD2]`) |
| FIX-016 | Contract coverage 64% (32/50): config CRUD, invoice CRUD, proof confirm/reject, refund flow, SA update/delete/list uncovered | P2 | V1 RECOMMENDED (prioritize refund + proof-confirm) | D | Financial mutations unguarded at contract level | cutover spec §7 (`MODULE_SPEC.member.dues-special-assessments.md`) |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A | P0 core-workflow / financial-integrity blockers | FIX-001, FIX-002, FIX-003 | High (FIX-001 touches the load-bearing settle seam; FIX-002 small; FIX-003 needs Batch F migration) | **Run in current `04` pass.** FIX-002 first (smallest, isolated), then FIX-003 (depends on Batch F migration), then FIX-001 (largest, salvage `initiateOnlinePayment.ts`). |
| Batch B | P1 RBAC / validation / privacy / proof atomicity | FIX-004, FIX-005, FIX-006, FIX-007 (over-refund cap + eligibility only), FIX-010 | Low–Medium (mechanical; existing patterns/utils; FIX-004 via TypeSpec regen) | **Run as a separate `04` pass** right after Batch A. Test-first; all have copy-from patterns. |
| Batch C | P1/P2 workflow completeness needing product decisions | FIX-007 (gateway-call portion), FIX-008, FIX-009, FIX-011, FIX-012, FIX-013, FIX-014, FIX-015 | Medium–High (cross-module + product-decision gated) | **Run only after product decisions** in §8 (Q-PD1/2/6/7) and confirmation Q-NC1. Split FIX-009 (funnel, cross-module m05/m07) and FIX-007-gateway (billing) into their own sub-passes. |
| Batch D | Test hardening / regression / contract coverage | RED tests for FIX-001/002/003/004/005/006 (written first, see §5) + FIX-016 | Low | **Tests for A/B written first, in-pass with their batch.** FIX-016 (refund + proof-confirm Hurl) runs **during** Batch B/C. |
| Batch E | Shared/platform dependency fixes | gateway-refund billing-API surface (supports FIX-007 gateway-call); `core/domain-event-consumers.ts` double-expiry de-dup (touched by FIX-001/002) | Medium (platform blast radius) | **Only after shared dependency resolved / verified.** Verify billing exposes connected-account refund before FIX-007 gateway-call; coordinate event-consumer change with FIX-001 sequencing. Do NOT bury in Batch A/B/C. |
| Batch F | Database/schema dependency fix | Receipt-number per-org/year counter table or per-org unique constraint + migration (supports FIX-003) | Medium (migration; seeds import dues schemas via shims) | **Run as the schema prerequisite for FIX-003, within the Batch A pass but as an explicitly-labeled migration step.** Flag to a future prompt-06 DB audit. |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Webhook end-to-end with REAL checkout metadata (`paymentTokenId`/`organizationId`, NO `paymentId`) → assert `DuesPayment` row created, invoice marked paid, receipt generated, expiry extended, fund allocations inserted | integration (backend) | The flagship online flow lands a complete, correct ledger record from the metadata the real checkout actually produces (reproduces P0 #1; current tests fake-green) | Extend `member/duesspecialassessments/stripeWebhook.integration.test.ts` (replace synthetic metadata at `:111-114`) or new `processStripePayment.integration.test.ts` co-located |
| FIX-002 | Treasurer of org A attempts refund of org B payment id → expect 403; sibling-pattern guard asserted | permission/RBAC | Cross-org refund is rejected; org B member expiry untouched (reproduces P0 #2) | Extend `member/duesspecialassessments/dues-mutation-auth.test.ts` (currently no refund cases) |
| FIX-003 | (a) Two orgs each record first payment of the year → both succeed with distinct receipt numbers (no unique violation); (b) concurrent same-org recording → no duplicate sequence | backend/unit + data/schema | Receipt numbers are unique per org/year and concurrency-safe (reproduces P0 #3) | New `member/duesspecialassessments/receipt-number-collision.test.ts`; extend `receipt-number.test.ts` (format-only today) |
| FIX-004 | RBAC matrix: non-treasurer member holding `association:admin` role → 403 on each of the ~10 ungated ops (config/gateway/funds/dunning/aging) | permission/RBAC | Treasurer/President gate enforced on every financial mutation | Extend `dues-mutation-auth.test.ts` (add the 10 ops) |
| FIX-005 | `upsertDuesFunds` with splits summing ≠ 100% → 400 "Fund percentages must total exactly 100%"; valid 100% → 200 | backend/unit | BR-05 enforced server-side | Extend `dues-config*.test.ts` or new `upsertDuesFunds.test.ts` co-located |
| FIX-006 | Plain member calls `listDuesInvoices` → sees only own invoices; officer → sees all | permission/RBAC | PAY-02 self-scoping applied to invoices | New `listDuesInvoices.test.ts` co-located (mirror `listDuesPayments` test) |
| FIX-007 (cap) | Partial refund then full refund exceeding remaining → rejected; refund ≤ remaining → allowed | backend/unit | Over-refund impossible; `validateRefundEligibility` enforced | Extend `refundDuesPayment.test.ts`; wire `refund-validation.test.ts` in-situ |
| FIX-007 (gateway) | Gateway-paid payment refund → billing refund API called (mock); manual payment → ledger-only (no gateway call) | integration + backend/unit | Gateway money actually returned for gateway payments only | Extend `refundDuesPayment.test.ts` with billing mock (Batch C/E) |
| FIX-008 | Overdue member + active dunning template → `runDunning` logs `dunning.escalation` event + creates notification; `sent > 0` | backend/unit + domain workflow | Stub converted to real escalation (uses existing `dunning-escalation.ts`) | Extend `dunning.test.ts` / `dunning-escalation.test.ts` (currently pure-fn only) |
| FIX-009 | First-invoice-on-approval (or generator includes `pendingPayment`) → approved member has an invoice; reminder email contains a `/pay/:token` URL | integration (cross-module) | Funnel reaches a payable invoice without manual officer action | New cross-module test near `approveMembershipApplication`/`generateDuesInvoicesForOrg`; extend `reminderProcessor` test for link presence |
| FIX-010 | Inject invoice-markPaid failure during `confirmPaymentProof` → no partial state (expiry not left extended; status not stuck `submitted`) | backend/unit (failure injection) | Confirm settles + status + invoice in one transaction (mirror `recordDuesPayment`) | Extend `confirmPaymentProof` test (add failure-injection case) |
| FIX-011 | Pending payment older than 24h → flips to `expired`, treasurer notified | backend/unit | Timeout job exists and notifies (after FIX-001 creates pending rows) | New `expirePendingPayments.test.ts` co-located |
| FIX-012 | Component: response carries `concurrentWarning` → confirm dialog/toast surfaced before second record completes | frontend/component | AC-M06-004 "proceeds only if confirmed" honored in UI | Extend `record-payment-form` component test (memberry) |
| FIX-013 | Two distinct Stripe events for the same payment-intent → settled once (single expiry extension, no duplicate allocations) | backend/integration | Idempotent per intent, not per `event.id` | Extend `stripeWebhook.integration.test.ts` |
| FIX-014 | Life member (2099 expiry) → checkout/link-mint/record blocked with "Life members are exempt from dues" | backend/unit | AC-M06-007 enforced at all 3 entry points | New `life-member-block.test.ts` co-located |
| FIX-015 | Partial refund across multiple funds → sum of reversal allocations equals `refundAmount` exactly (no centavo drift) | backend/unit | Last-fund-absorbs reversal math (reuse `allocateFunds`) | Extend `refundDuesPayment.test.ts` / `fund-math.test.ts` |
| FIX-016 | Hurl scenarios: refund flow + proof confirm/reject (financial-mutation contract coverage) | contract | Financial mutations guarded at contract level (64% → higher on the risky ops) | New `.hurl` files under `specs/api/tests/contract/` (refund, proof-confirm) |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `member/duesspecialassessments/checkoutPaymentToken.ts`, `jobs/processStripePayment.ts`, `association:member/utils/settle-payment.ts`, salvage from `initiateOnlinePayment.ts`; `core/domain-event-consumers.ts` (avoid double-expiry) | module-local + shared/platform (settle seam, event consumer) | High — settle seam imports `membership-lifecycle.ts` (membership module) `[CROSS-MODULE RISK]` |
| FIX-002 | `member/duesspecialassessments/refundDuesPayment.ts`; `dues-payments.repo.ts` (scope `getPayment`) | module-local | Low |
| FIX-003 | `recordDuesPayment.ts`, `submitPaymentProof.ts`, `initiateOnlinePayment.ts`, `dues-payments.repo.ts:244-254`; new migration + counter table/constraint (Batch F) | module-local + database/schema | Medium — schema migration; seeds import dues schemas via shims |
| FIX-004 | TypeSpec op definitions for the 10 ops (`@extension("x-require-position", ...)`), regenerate `routes.ts`; `dues-mutation-auth.test.ts` | module-local (via shared TypeSpec/generate pipeline) | Medium — regen pipeline (`specs/api` build + `generate.ts`); generated files must not be hand-edited |
| FIX-005 | `upsertDuesFunds.ts` (call `fund-math.ts:validateFundSplits`) | module-local | Low |
| FIX-006 | `listDuesInvoices.ts` (apply PAY-02 self-scope) | module-local | Low |
| FIX-007 | `refundDuesPayment.ts` (cap + wire `refund-validation.ts`); gateway-call part: `core/billing`/`handlers/billing` refund surface | module-local (cap) + shared/platform (gateway call) | Medium — gateway part depends on billing module (Batch E) |
| FIX-008 | `runDunning.ts`, `dunning-escalation.ts` (wire), `jobs/index.ts` (register dunning cron), `notification-triggers.ts` (emit `dunning.escalation`) | module-local + shared/platform (jobs registry, notif) | Medium — adds a cron; notif/event fan-out |
| FIX-009 | `approveMembershipApplication.ts` (m05) OR `generateDuesInvoicesForOrg.ts`; `reminderProcessor.ts` (mint token link); possibly `org/$orgSlug/dues.tsx` / `my/payments.tsx` CTA | cross-module (m05 membership, m07/m22 comms/email) | High `[CROSS-MODULE RISK]` |
| FIX-010 | `confirmPaymentProof.ts` (wrap in `db.transaction`) | module-local | Low–Medium (touches settle seam) |
| FIX-011 | new interval job + `jobs/index.ts`; treasurer notification trigger | module-local + shared/platform (jobs) | Low–Medium |
| FIX-012 | `apps/memberry` `record-payment-form.tsx` (surface `concurrentWarning`) | module-local (frontend) | Low |
| FIX-013 | `stripeWebhook.ts`, `jobs/processStripePayment.ts` (idempotent settle per intent) | module-local | Medium (with FIX-001) |
| FIX-014 | `checkoutPaymentToken.ts`, `sendPaymentLink.ts`, `recordDuesPayment.ts` (life-member check) | module-local | Low |
| FIX-015 | `association:member/utils/membership-lifecycle.ts:193-201` (reversal math) | shared/platform (membership util) | Medium `[CROSS-MODULE RISK]` |
| FIX-016 | `specs/api/tests/contract/*.hurl` (new refund + proof-confirm scenarios) | module-local (contract tests) | Low |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001, FIX-010, FIX-015 | cross-module | `member/membership/utils/membership-lifecycle.ts` (settle/refund/expiry/status), reached via `settle-payment.ts` | Dues settle/refund fixes mutate membership-status logic; load-bearing seam | Coordinate with membership-lifecycle gap plan; not a hard pre-req but high blast radius `[CROSS-MODULE RISK]` |
| FIX-001, FIX-002 | shared/platform | `core/domain-event-consumers.ts` dues hooks (lines 74-166) | Expiry is updated both inline in settle AND via the event consumer — idempotent but redundant; don't double-fix or break the consumer | Verify before changing settle path (Batch E) |
| FIX-007 (gateway) | shared/platform | `core/billing` service + `handlers/billing` (connected-account refund API) | Gateway refund needs billing to expose refund for connected accounts | Yes — verify billing surface before implementing gateway-call (Batch E) |
| FIX-003 | database/schema | Schemas split across `handlers/dues/repos/` + `association:member/repos/` + re-export shims; seeds import via shims | Receipt-number fix needs a migration (per-org/year counter table or per-org unique); seed import paths must not break | Yes — Batch F migration before FIX-003 code; flag to prompt-06 DB audit `[SHARED DEPENDENCY]` |
| FIX-004 | environment/tooling | TypeSpec regen pipeline (`specs/api` build + `services/api-ts` `generate.ts`) | Permission gating must go through `x-require-position` extensions, not hand-edits to generated `routes.ts` | Yes — run regen workflow; do not edit generated files |
| FIX-009 | cross-module + product decision | `approveMembershipApplication` (m05); `communication`/`email`/`notifs` (m07/m22) for reminder links | Funnel fix touches membership + comms modules; trigger design is a product choice | Yes — product decision Q-PD7 + coordinate with m05/m07 `[CROSS-MODULE RISK]` |
| FIX-004 (severity) | product decision / confirmation | `association:admin` Better-Auth `user.role` grant semantics | Determines the true blast radius (who currently can mutate gateway/funds) — does NOT change validity of the fix | Confirm Q-NC1 before sizing; fix proceeds regardless |
| FIX-008, FIX-011 | shared/platform | `jobs/index.ts` cron registry; OneSignal/email notif fan-out | New crons + notifications use shared jobs + notif infra | Standard registration; restart API after new cron/route registration |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q-PD1 — Token expiry: 30 days (AC-M06-003) or 72h (impl)? Also: consume token on confirmation vs on checkout creation | `[NEEDS PRODUCT DECISION]` | (token-UX item, deferred) | Determines token-lifecycle fix direction; abandoned checkout currently burns the link | Decide canonical expiry + consume-on-confirm; until then defer the token-expiry change (see §10) |
| Q-PD2 — Should partial refunds reverse membership expiry proportionally, or only full refunds (current)? | `[NEEDS PRODUCT DECISION]` | FIX-015 (and FIX-007 scope) | BR-08 wording ambiguous; affects refund reversal scope | Confirm before implementing partial-refund expiry behavior; FIX-015 rounding fix can proceed for the allocation-sum invariant regardless |
| Q-PD3 — When no funds configured, default-fund allocation or skip (current)? | `[NEEDS PRODUCT DECISION]` | FIX-001 (settle behavior) | Affects settle + reporting on no-fund orgs | Confirm; FIX-001 can ship with current skip behavior if decision pending, but document |
| Q-NC1 — Who receives `association:admin` role; is it officer-equivalent? | `[NEEDS CONFIRMATION]` | FIX-004 (severity sizing) | Determines true blast radius of the ungated mutations | Trace grant site in `middleware/auth.ts` consumers; fix proceeds regardless |
| Q-PD5 — Is PayMongo a V1 requirement, or Stripe-only for pilot? | `[NEEDS PRODUCT DECISION]` | (PayMongo wiring — deferred) | Decides adapter-wiring vs provider-gating | If not V1: gate provider choice to `stripe` (small) and defer adapter wiring |
| Q-PD6 — Is gateway-API refund execution required for V1, or is ledger-only acceptable for pilot (manual Stripe-dashboard refund)? | `[NEEDS PRODUCT DECISION]` | FIX-007 (gateway-call portion) | Scopes refund fix; touches billing module | If ledger-only acceptable for pilot: ship FIX-007 cap + eligibility now, defer gateway-call to Batch C/E |
| Q-PD7 — First-invoice trigger: event consumer on MembershipApproved, or widen `generateDuesInvoicesForOrg` to `pendingPayment`? | ✅ **DECIDED (2026-06-13)** → **(a) event consumer** on the existing `membership.created` event. **RESOLVED** in fix-report §D (Step 45). | FIX-009 | Cross-module design choice at the m05 seam | — done |
| Q-PD8 — Should member self-serve "Pay Now" from dashboard be V1, or are emailed links sufficient? | ✅ **DECIDED (2026-06-13)** → **(a) self-serve** Pay Now (reuse shipped org-dues proof flow + new `My Payments` CTA). **RESOLVED** in fix-report §D (Step 45). Emailed links = V2. | FIX-009 (CTA portion) | Scopes the funnel fix UI | — done |
| Q-NC2 — Is `gatewayConfig.publicKey` actually storing the Stripe connected-account id (`acct_...`)? | `[NEEDS CONFIRMATION]` | FIX-001 / BR-30 | Determines if checkout routes money to the correct org account | Trace at `checkoutPaymentToken.ts:65-68` before relying on it in FIX-001 |
| Q-NC3 — Are m06 §18 feature flags (`dues.onlinePayment` etc.) still intended? No flag infra usage found | `[NEEDS CONFIRMATION]` | (flags — deferred P3) | Spec/impl drift | Confirm intent; if deferred, no action |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| FIX-007 gateway-refund-API call | `[NEEDS PRODUCT DECISION]` Q-PD6 + `[SHARED DEPENDENCY]` | Requires product decision on V1 scope AND verification that `core/billing` exposes connected-account refund | Answer Q-PD6; verify billing refund surface (Batch E) |
| FIX-009 first-invoice trigger + reminder links + Pay-Now CTA | `[NEEDS PRODUCT DECISION]` Q-PD7/Q-PD8 + `[CROSS-MODULE RISK]` | Trigger mechanism is a product/eng decision; touches m05 membership + m07/m22 comms | Answer Q-PD7/Q-PD8; coordinate with membership + comms modules |
| FIX-011 24h pending→expired timeout | depends on FIX-001 | No pending online-payment rows exist until FIX-001 creates them | FIX-001 landed |
| FIX-015 partial-refund expiry reversal direction | `[NEEDS PRODUCT DECISION]` Q-PD2 | Whether partial refund reverses expiry at all is ambiguous in BR-08 | Answer Q-PD2 (allocation-sum invariant part can proceed independently) |
| Token-expiry change (72h→30d) + consume-on-confirm | `[NEEDS PRODUCT DECISION]` Q-PD1 | Canonical expiry undecided; abandoned-checkout behavior depends on it | Answer Q-PD1 |
| PayMongo adapter wiring | `[NEEDS PRODUCT DECISION]` Q-PD5 | Unknown if PayMongo is V1; checkout hardcodes Stripe billing service | Answer Q-PD5 (provider-gate to `stripe` is the low-risk fallback) |

## 10. Deferred Items

Items not included in the active fix sequence.

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Token expiry 72h→30d + consume-on-confirm | gap §5 AC-M06-003, §10 token row | V1 RECOMMENDED `[NEEDS PRODUCT DECISION Q-PD1]` | Blocked on canonical-expiry decision; not safe to change direction without it |
| `submitted→confirmed` direct transition vs routing through `underReview` | gap §4 M6-R2 row | P3 | State machine allows it; spec routes through `underReview` — low-risk polish |
| `dues_reminder_schedule` shape divergence (single `daysOffset` + booleans vs `daysBefore/daysAfter` + channel enum) | gap §13 | P3 (sms/letter are V2) | Spec sync; sms/letter channels have no delivery infra `[DO NOT OVERBUILD]` |
| `validatePaymentToken` returns `dueDate: token.expiresAt` (mislabeled) | gap §13 | P3 | API-clarity rename; cosmetic |
| `runDunning` honors `body.organizationId || ctx.orgId` (body can target another org's templates) | gap §13 | P2 | Folds into FIX-008 dunning work; enforce org equality there (do not over-scope as separate fix) |
| `applySpecialAssessment` TypeSpec result-shape drift | gap §13 | P3 | Pre-existing ticket; contract-shape resolution |
| Dues schema topology / shim cleanup | gap §13, §21 | P3 `[SHARED DEPENDENCY]` | Cleanup wave when seeds rewrite imports; defer to prompt-06 DB audit |
| `dues_payment.invoice_id` missing FK | gap §13 | P3 `[NEEDS CONFIRMATION]` | Add FK once invoice table location stabilizes |
| Doc sync (MODULE_SPEC.dues.md paths, CLAUDE.md `bulkRecordPayments`, cutover spec §7 "plaintext" note now encrypted, m06 §20 stale instructions) | gap §22, §12 | P3 | Cheap doc-drift cleanup; not a workflow/reliability fix — can ride along but not in active fix scope |
| `recalculateAgingBucket` keep-but-gate | gap §6 | folds into FIX-004 | Gating handled by FIX-004; no separate work |
| Webhook manual-retry raw-`actorRole` string check | gap §14 | P3 `[NEEDS CONFIRMATION]` | Clarify exposure path; no registered route found |
| GCash direct integration (`dues.gcashDirect`) | gap §23 | V2 DEFERRED | PayMongo covers GCash; flag default false |
| Multi-currency support | gap §23 | V2 DEFERRED | PHP-only is the deliberate default |
| SMS/letter dunning channels | gap §23 | V2 DEFERRED | No delivery infra |
| Enhanced dunning V2 templates (`dues.dunningV2`) | gap §23 | V2 DEFERRED | Get basic escalation (FIX-008) working first |
| Royalty split (chapter↔national revenue sharing) | gap §23 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | No schema/handlers; not in any AC |
| Receipt PDF pipeline rework (current HTML) | gap §23 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Fix numbering (FIX-003) first; format is polish |
| Observability metrics suite (m06 §17) | gap §23 | V2 DEFERRED | Structured logs exist; metrics is platform-wide |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Generic multi-gateway adapter / plugin framework beyond Stripe(+PayMongo) | gap §23 | `[DO NOT OVERBUILD]` — M6-R12 is satisfied by the existing adapter interface once wired; do not build a plugin system |
| Caching layer for gateway config / reminder schedule (m06 §16) | gap §23 | `[DO NOT OVERBUILD]` — no evidence of load problems; premature |
| Expanding the 5 unregistered helper handlers (`generatePaymentLink`, `generatePaymentReceipt`, `handlePaymentWebhook`, `initiateOnlinePayment`, `validatePaymentLink`) into public endpoints | gap §6, §12, §23 | Superseded by fixing the registered flow (FIX-001). Salvage `initiateOnlinePayment` logic into the registered path or delete — do NOT register as-is |
| billing.tsp duplicate `handleStripeWebhook` generated route removal | gap §6, §12 | Separate billing-module ticket `[SHARED DEPENDENCY]`; out of scope for dues module pass |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Structural metadata-contract mismatch: checkout writes `{paymentTokenId,...}` with no payment row; webhook reads `metadata.paymentId`. Fix the seam (create pending payment + carry UUID), not the symptom (don't just patch the fallback). `[NEEDS CONFIRMATION]` on exact runtime error — static evidence conclusive |
| FIX-002 | Root cause | Missing tenant guard + unscoped `getPayment` repo method; mirror the confirm/reject pattern |
| FIX-003 | Root cause | Hardcoded `'ORG'` prefix + global-unique constraint + count-based sequence. Fix all three: real org code, per-org/year counter, scope uniqueness — not a band-aid on one call site |
| FIX-004 | Root cause | Ops never declared `x-require-position`; root fix is at the TypeSpec/extension layer (generated middleware), not inline patches |
| FIX-005 | Root cause | Validation absent server-side; util exists — wire it |
| FIX-006 | Root cause | Handler never self-scopes; copy the PAY-02 pattern that `listDuesPayments` already uses |
| FIX-007 | Root cause (cap) / shared-dep (gateway) | Over-refund: missing cap + unwired eligibility util (root). Gateway-call: genuinely missing integration (root, but billing-dependent) |
| FIX-008 | Root cause | `runDunning` body is a stub; the real escalation logic already exists in `dunning-escalation.ts` — wiring, not new logic |
| FIX-009 | Root cause | Two root causes: approval sets `pendingPayment` + generator filters `active` (no first invoice); reminders mint no link. Both structural, cross-module |
| FIX-010 | Root cause | Non-transactional settle in `confirmPaymentProof` + swallowed errors; wrap in `db.transaction` (mirror `recordDuesPayment`) |
| FIX-011 | Root cause | No timeout job ever written; depends on FIX-001 producing pending rows |
| FIX-012 | Symptom-adjacent (root is design) | Backend returns warning AFTER creation; real fix is pre-check/two-phase confirm. Minimum (surface warning) is acceptable but document it as partial |
| FIX-013 | Root cause | Idempotency keyed on wrong identifier (`event.id` not intent); make settlement idempotent per intent |
| FIX-014 | Root cause | Life-member rule never enforced; add check at all 3 entry points |
| FIX-015 | Root cause | Per-allocation rounding without last-fund-absorbs on reversal; reuse `allocateFunds` |
| FIX-016 | Root cause (coverage) | Financial mutations untested at contract level; add the high-risk scenarios |

## 13. Recommended First Fix Batch

**Batch name:** Batch A — P0 core-workflow / financial-integrity blockers (with Batch F migration as the schema prerequisite for FIX-003).

**Included Fix IDs:** FIX-002, FIX-003 (+ Batch F migration), FIX-001 — in that order.

**Why this batch comes first:** these three P0s are exactly why the audit decision is FAIL. They concern real money: a flagship flow that charges members and leaves no record (FIX-001), a tenant-isolation breach allowing cross-org refunds (FIX-002), and a receipt-collision that breaks manual recording in the platform's main multi-org mode (FIX-003). Sequence FIX-002 first (smallest, fully isolated, immediate risk reduction), then FIX-003 after the Batch F counter-table migration lands, then FIX-001 (largest, touches the load-bearing settle seam and salvages `initiateOnlinePayment.ts`).

**Tests to write first (RED before code):**
- FIX-002: cross-org refund 403 in `dues-mutation-auth.test.ts`.
- FIX-003: two-org receipt-collision + concurrent same-org recording test (new `receipt-number-collision.test.ts`).
- FIX-001: webhook end-to-end integration test driving the REAL checkout metadata shape (no `paymentId`), asserting payment row + invoice paid + receipt + expiry + allocations — this is the single most important artifact; current green tests are fake-green.

**Explicit out-of-scope for Batch A:**
- All of Batch B/C/D/E (except the Batch F migration that FIX-003 requires).
- FIX-007 gateway-refund call (blocked Q-PD6 + billing dependency).
- FIX-009 funnel (blocked Q-PD7/Q-PD8, cross-module).
- Token-expiry change, PayMongo wiring, partial-refund expiry direction (blocked product decisions).
- Everything in §10 Deferred and §11 Do Not Build.
- Do NOT register the 5 unregistered helper handlers as-is; salvage `initiateOnlinePayment` logic into the registered flow or delete.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Dues & Payments
- **Exact module slug:** dues-payments
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md`
- **Source gap plan (context only):** `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/dues-payments-gap-plan.md`
- **Exact batch to execute first:** Batch A — P0 core-workflow / financial-integrity blockers (FIX-002 → Batch F migration → FIX-003 → FIX-001). Run Batch B as the next separate `04` pass.
- **Tests to prioritize (write failing first):** (1) webhook end-to-end integration test with REAL checkout metadata (FIX-001) — extend/replace synthetic metadata in `member/duesspecialassessments/stripeWebhook.integration.test.ts:111-114`; (2) cross-org refund 403 in `dues-mutation-auth.test.ts` (FIX-002); (3) two-org receipt collision + concurrent recording (FIX-003). Do not weaken or skip these into shallow assertions — they must assert ledger/receipt/invoice/expiry/membership side-effects.
- **Files likely to touch (Batch A + F):** `checkoutPaymentToken.ts`, `jobs/processStripePayment.ts`, `association:member/utils/settle-payment.ts`, salvage from `initiateOnlinePayment.ts`, `refundDuesPayment.ts`, `dues-payments.repo.ts` (scope `getPayment`; receipt sequence), `recordDuesPayment.ts`/`submitPaymentProof.ts` (receipt prefix), new receipt-counter migration + schema.
- **Shared/database cautions:**
  - `settle-payment.ts` delegates into `member/membership/utils/membership-lifecycle.ts` — membership module owns it; any settle/refund/expiry change has membership blast radius `[CROSS-MODULE RISK]`. Tests must assert membership status side-effects.
  - Expiry is updated BOTH inline in settle AND via `core/domain-event-consumers.ts` (lines 74-166) — do not double-fix or break the consumer; coordinate (Batch E).
  - FIX-003 needs a DB migration (per-org/year counter or per-org unique); seeds import dues schemas via re-export shims — verify seed import paths survive. Run migration as the explicit Batch F step before FIX-003 code; flag to prompt-06 DB audit.
  - FIX-004 (Batch B) must use `@extension("x-require-position", #["Treasurer","President"])` in TypeSpec + regenerate (`cd specs/api && bun run build`, then `cd services/api-ts && bun run generate`). Never hand-edit generated `routes.ts`. Restart the API after new route/cron registrations.
  - `[NEEDS CONFIRMATION]` on the exact runtime error of the webhook seam and on `gatewayConfig.publicKey` being an `acct_...` connected-account id (Q-NC2) — verify during FIX-001.
- **Items NOT to implement in this pass:** FIX-007 gateway-refund-API call (blocked Q-PD6 + billing dep); FIX-008/FIX-009/FIX-011 and other Batch C items (product-decision/cross-module gated); token-expiry change (Q-PD1); PayMongo wiring (Q-PD5); partial-refund expiry direction (Q-PD2); everything in §10 Deferred and §11 Do Not Build; do not register the 5 unregistered helper handlers as public endpoints (salvage `initiateOnlinePayment` logic or delete).

---

Next recommended step:
Module/group: Dues & Payments
Module slug: dues-payments
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md
Recommended batch: Batch A — P0 core-workflow / financial-integrity blockers (with Batch F receipt-counter migration)
