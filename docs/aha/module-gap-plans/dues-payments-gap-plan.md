# AHA Module/Group Gap Plan: Dues & Payments

Date: 2026-06-11
Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dues & Payments |
| Module slug | dues-payments |
| Type | Business Module |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/dues-payments-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m06-dues-payments/MODULE_SPEC.md` (Spec v2.0, 2026-05-21) |
| Supporting PRDs/specs used | `docs/product/MODULE_SPEC.dues.md`, `docs/product/MODULE_SPEC.member.dues-special-assessments.md`, `docs/product/STATE_MACHINES.md` (via m06 §8), ROLE_PERMISSION_MATRIX §3.4 (via m06 §6), `docs/quality/HAND_WIRED_ROUTES.yaml` |
| PRD/spec coverage quality | Strong (m06 spec is complete and detailed; the two handler-level specs are partially stale on file paths) |
| Paths inspected | `services/api-ts/src/handlers/member/duesspecialassessments/` (50 handlers + 3 jobs + 1 util + 32 test files), `services/api-ts/src/handlers/dues/repos/` (5 files, repos only), `services/api-ts/src/handlers/association:member/repos/` (dues/dunning/special-assessments/status-history schemas + repos), `services/api-ts/src/handlers/association:member/utils/` (settle-payment, receipt-number, refund-validation, reminder-schedule, dunning-escalation, gateway-adapter, paymongo.adapter), `services/api-ts/src/handlers/member/membership/utils/` (membership-lifecycle, fund-math), `services/api-ts/src/generated/openapi/routes.ts` (dues route registrations + middleware chains), `services/api-ts/src/middleware/{auth,org-context}.ts`, `services/api-ts/src/core/auth/officer-checks.ts`, `services/api-ts/src/core/domain-event-consumers.ts`, `services/api-ts/src/core/gateway.ts`, `services/api-ts/src/app.ts` (hand-wired webhook), `apps/memberry/src/routes/` (pay/$token, my/payments, org officer finances/payments/dues pages), `specs/api/tests/contract/` (18 dues-related .hurl files) |
| PRDs/specs inspected | m06 MODULE_SPEC.md (all 22 sections), MODULE_SPEC.dues.md, MODULE_SPEC.member.dues-special-assessments.md (incl. §7 open follow-ups) |
| KG used | Yes (status notes at `docs/aha/kg/knowledge-graph-status.md`; used as secondary evidence only — all findings verified by direct code inspection) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status notes at `docs/aha/kg/domain-knowledge-status.md`; product docs were primary) |
| `/understand-domain` refreshed | No |
| Webwright used | No — static review sufficient; browser tooling skipped for batch run |
| Playwright/E2E inspected | Yes (14 dues/payment E2E spec files inspected statically; none executed) |
| Existing tests inspected | 32 unit/integration test files in `member/duesspecialassessments/`, `dues-payments.repo.test.ts`, `receipt-number.test.ts`, `refund-validation.test.ts`, `settle-payment.test.ts`, `reminder-schedule.test.ts`, `gateway-adapter.test.ts`, 18 Hurl contract files, 14 Playwright specs |
| Cross-cutting audit reviewed | Not Available (not yet produced) |
| Database/schema audit reviewed | Not Available (not yet produced) |
| Limitations | Static review only — no server boot, no live webhook replay, no Playwright execution. Runtime failure modes of the broken webhook→settlement seam are inferred from code (marked `[NEEDS CONFIRMATION]` where exact runtime behavior matters). `association:admin` role-assignment semantics not traced to its grant site. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M06 Module Spec | `docs/product/modules/m06-dues-payments/MODULE_SPEC.md` | PRD/module spec | Current | Primary: workflows WF-038–045, BRs, ACs, state machine, permissions, entities |
| M06 API contracts | `docs/product/modules/m06-dues-payments/API_CONTRACTS.md` | API contract | Current | Endpoint expectations (cross-checked at route level) |
| Dues handler spec | `docs/product/MODULE_SPEC.dues.md` | module spec (source-derived) | Stale on paths | Describes the old `handlers/dues/` layout; handlers since moved to `member/duesspecialassessments/`; lists `bulkRecordPayments.test.ts` and `jobs/autoInvoiceGenerator.ts` which no longer exist |
| DuesSpecialAssessments cutover spec | `docs/product/MODULE_SPEC.member.dues-special-assessments.md` | module spec / cutover record | Current (with §7 open follow-ups) | Authoritative for current file topology, TypeSpec tags, contract coverage (64%), known drift items |
| Role/Permission Matrix §3.4 | `docs/product/ROLE_PERMISSION_MATRIX.md` | acceptance criteria | Current | Treasurer/President + 2FA requirements for all financial mutations |
| State machines | `docs/product/STATE_MACHINES.md` | workflow spec | Current | Payment status machine (mirrored in m06 §8) |
| Hand-wired route allowlist | `docs/quality/HAND_WIRED_ROUTES.yaml` | API contract | Current | `/webhooks/stripe` entry verified present (line 47) |
| CLAUDE.md module map | `CLAUDE.md` | repo guidance | Stale | Says "dues — ~8 handlers"; cites `bulkRecordPayments` which does not exist anywhere in the codebase |

## 3. Expected vs Actual

**Expected (m06 spec):** the financial engine — online payment via gateway checkout with webhook confirmation, manual recording with receipt + fund split + expiry extension, idempotent webhooks, refunds (gateway + manual) with allocation/expiry reversal, automated reminders + dunning escalation, receipts with unique `ORG_CODE-YEAR-SEQ` numbering, financial dashboard/reports, gateway config per org, all mutations gated to Treasurer/President with 2FA.

**Actual:**

- **Manual payment recording is the only fully working payment path.** `recordDuesPayment.ts` correctly does receipt → optimistic-locked invoice markPaid → fund allocation (correct last-fund rounding via `fund-math.ts:allocateFunds`, ordered by `sortOrder` via `listFunds`) → expiry extension → status history, all in one transaction.
- **The online one-tap payment flow is broken at the webhook→settlement seam.** `checkoutPaymentToken.ts` creates a Stripe checkout session with metadata `{paymentTokenId, personId, organizationId, invoiceId}` and creates **no DuesPayment row**. `jobs/processStripePayment.ts` expects `metadata.paymentId` and falls back to the Stripe PaymentIntent id (`pi_...`), then calls `settlePayment` which inserts fund allocations with that non-UUID `paymentId` into a `uuid` FK column — guaranteed insert failure whenever funds are configured, dead-lettering the webhook. Even when no funds are configured (allocation skipped), no payment record is ever created, the invoice is never marked paid, and no receipt exists. Unit/integration tests pass because they use synthetic metadata containing `paymentId`/`orgId` (`stripeWebhook.test.ts:34`, `stripeWebhook.integration.test.ts:111-114`) — a shape the real checkout never produces. `[NEEDS CONFIRMATION]` for exact runtime error, but the static evidence is conclusive.
- **Receipt numbering violates M6-R6 and will collide across orgs.** All three call sites hardcode the prefix: `formatReceiptNumber('ORG', year, sequence)` (`recordDuesPayment.ts:43`, `submitPaymentProof.ts:65`, `initiateOnlinePayment.ts:52`), while `getNextReceiptSequence` counts per-org and the schema enforces **global** uniqueness (`dues_payment_receipt_unique` on `receipt_number` only). Two orgs will both generate `ORG-2026-000001`; the second insert fails.
- **Permission enforcement is inconsistent.** ~Half the officer mutations call `requirePosition([Treasurer, President])` (record/refund/confirm/reject payments, invoice CRUD, createDuesConfig, reports/dashboard); the other half have **no position check at all** (updateDuesConfig, deleteDuesConfig, upsertDuesGatewayConfig, disconnectDuesGateway, testDuesGatewayConnection, upsertDuesFunds, runDunning, dunning template CRUD, recalculateAgingBucket) — any org member whose user role is `association:admin` can mutate gateway credentials and fund splits.
- **refundDuesPayment has no cross-org guard** (every sibling mutation has one) and never calls the gateway refund API.
- **Dunning escalation is a stub** — `runDunning.ts` contains "In a full implementation, we would query overdue memberships… For now…" and always returns `sent: 0`; the escalation util (`dunning-escalation.ts`) has zero production consumers; no dunning cron is registered.
- **Reminders work** (daily cron, M6-R5 default 60/30/7/-7/-30 schedule, dedup via `duesReminderLogs`, active/gracePeriod scoping) but reminder notifications contain **no one-tap payment link** — the WF-038 entry point ("member receives reminder with one-tap payment link") doesn't exist, and there is no member-facing "Pay Now" checkout on `/org/$orgSlug/dues` or `/my/payments`.
- **No first-invoice generation on MembershipApproved** (spec §10b consumed events): `approveMembershipApplication.ts` creates membership with `status: 'pendingPayment'` and no invoice; `generateDuesInvoicesForOrg.ts:75` filters `status='active'` only, so newly approved members are invisible to the batch generator. `[CROSS-MODULE RISK]` with m05.
- Gateway credentials are now properly encrypted (AES-GCM, `core/gateway.ts:encryptCredential`) — the "plaintext-at-rest" note in MODULE_SPEC.member.dues-special-assessments §7 is outdated.
- The `expired` payment status (24h webhook timeout, WF-038 exception + spec §15) is never set by any code path; no timeout job exists.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-038 Pay Dues Online | Reminder link or dashboard → checkout → webhook confirms → expiry + funds + receipt | Token checkout creates Stripe session but no payment record; webhook settle uses wrong metadata key; no reminder links; no dashboard Pay Now | `pay/$token.tsx` exists; no Pay CTA on member dues pages | `checkoutPaymentToken.ts`, `jobs/processStripePayment.ts:44` | `payment_token` table | webhook tests use synthetic metadata | Partially Implemented (broken end-to-end) | Yes — P0 |
| WF-039 / BR-05 / M6-R1 / AC-M06-001 Fund allocation | Floor + last-fund-by-sortOrder absorbs remainder; sum invariant | Implemented correctly | — | `fund-math.ts:allocateFunds`, `listFunds` orders by `sortOrder` | `dues_fund.sort_order` | `fund-math` covered via settle/record tests | Implemented | No (config validation gap tracked separately) |
| WF-040 / BR-04 Dues config | Treasurer sets amount/frequency/grace; category overrides | CRUD handlers exist; create gated, update/delete ungated | `officer/settings/dues.tsx` | `createDuesConfig.ts` (requirePosition ✓), `updateDuesConfig.ts` / `deleteDuesConfig.ts` (✗) | `dues_org_config`, `dues_category_override` | `dues-config*.test.ts` | Partially Implemented | Yes — P1 |
| WF-041 / BR-08 / AC-M06-006 Refunds | Full/partial, gateway API call, allocation reversal, expiry reversal, status recompute | Ledger reversal + full-refund expiry reset implemented; **no gateway API call**; no cross-org guard; over-refund unguarded; `refund-validation.ts` util unwired | `officer/payment-refund.spec.ts` E2E | `refundDuesPayment.ts`, `membership-lifecycle.ts:processRefund` | `refunded_amount`, `is_reversal` | `refundDuesPayment.test.ts`, `refund-validation.test.ts` (util untested in situ) | Partially Implemented | Yes — P0/P1 |
| WF-042 / M6-R5 Reminders + dunning | Cron reminders per schedule; escalation via templates | Reminders: implemented (daily cron, dedup, default schedule). Escalation: stub | — | `jobs/reminderProcessor.ts`, `reminder-schedule.ts` ✓; `runDunning.ts:40-52` stub | `dues_reminder_schedule`, `dunning_*` tables | `dunning.test.ts`, `dunning-escalation.test.ts` (pure-fn only) | Partially Implemented | Yes — P1 |
| WF-043 / AC-M06-005 Financial dashboard/reports | Collection, fund, aging, status reports | Implemented (invoice-aware stats) | `officer/finances/*` routes | `getDuesDashboard.ts` → `getFullDashboardStats`, `generateDuesReport.ts` (collection/fund_breakdown/aging) | aging bucket table | `getDuesDashboard.test.ts`, `getDuesFinancialDashboard.test.ts`, `aging-buckets-flow.hurl` | Implemented | Minor (report-vs-gateway reconciliation untested) |
| WF-044 / BR-06 Manual payment | Officer records offline payment, receipt, fund split, recorder identity | Implemented, transactional, optimistic invoice lock | `officer/payments/new.tsx` + `record-payment-form.tsx` | `recordDuesPayment.ts` | `dues_payment.recorded_by` | `recordDuesPayment.test.ts`, E2E `officer/payments.spec.ts` | Implemented | Receipt-prefix bug shared (P0 #3) |
| WF-045 / M6-R6 Receipt generation | Unique `ORG_CODE-YEAR-SEQ`, no dupes per org/year | Format util correct, but all callers hardcode `'ORG'`; global-unique constraint + per-org counting ⇒ cross-org collision; count-based sequence races | receipt download on `my/payments` | `recordDuesPayment.ts:43`, `dues-payments.repo.ts:244-254` | `dues_payment_receipt_unique` (global) | `receipt-number.test.ts` (format only) | Partially Implemented | Yes — P0 |
| M6-R8 / AC-M06-002 Webhook idempotency | `gateway_transaction_id` as idempotency key; duplicate → 200 skip | Idempotency keyed on Stripe `event.id` (not transaction id); unique constraint exists; select-then-insert race handled by constraint but error path mislabels | — | `stripeWebhook.ts:29` (`idempotencyKey: event.id`), `webhookRetryProcessor.ts:119-169` | `webhook_retry_idempotency_unique` | `stripeWebhook.test.ts`, `dues-stripe-webhook.hurl` | Partially Implemented | Yes — P2 |
| M6-R2 / §8 Payment state machine | 10-status machine, invalid transitions rejected | Implemented + persisted history on every transition | — | `utils/status-transitions.ts:87-98`, `updatePaymentStatus` writes `duesPaymentStatusHistory` | `dues_payment_status_history` | `status-transitions.test.ts` | Implemented | `submitted→confirmed` also allowed directly (spec routes through `underReview`) — P3 |
| §8 `pending → expired` (24h) + §15 treasurer notify | Timeout job flips status, notifies treasurer | Never set anywhere; no job | `officer/payment-expiry.spec.ts` tests BR-07 extension, not 24h expiry | grep: `'expired'` appears only in enum | enum value exists, `expired_at` column unused | none | Missing | Yes — P2 |
| M6-R4 / AC-M06-004 Concurrent duplicate warning | Warn second treasurer; proceed only if confirmed | Backend detects 5-min window but records payment first and returns `meta.concurrentWarning` after the fact; frontend ignores it | `record-payment-form.tsx` — zero references to `concurrentWarning` | `recordDuesPayment.ts:37-38,122` | — | none for the warning path | Partially Implemented | Yes — P2 |
| AC-M06-003 One-tap token payment | No-login payment; token expires after **30 days** | Token flow exists (HMAC-SHA256, hash-only storage, single-use); expiry is **72 hours** | `pay/$token.tsx` | `utils/payment-token.ts:10` (`PAYMENT_TOKEN_EXPIRY_HOURS = 72`) | `payment_token.expires_at` | `validatePaymentToken.test.ts`, `payment-token-validate.hurl` | Partially Implemented | Yes — P2 `[NEEDS PRODUCT DECISION]` |
| AC-M06-007 Life member payment block | Checkout blocked: "Life members are exempt from dues" | No life-member / 2099 check anywhere in dues handlers | — | grep `life|2099` over module: zero hits | — | none | Missing | Yes — P2 |
| BR-30 Two-level gateway isolation | Org gateway separate from platform gateway; no cross-org leakage | Config is per-org; but checkout passes `gatewayConfig.publicKey` as Stripe `connectedAccountId` `[NEEDS CONFIRMATION]`; PayMongo configurable but unwired | — | `checkoutPaymentToken.ts:68` | `dues_gateway_config` per org | `gateway-config-flow.hurl` | Partially Implemented | Yes — P2 |
| BR-32 7-year retention / no hard delete of payments | Payments never hard-deleted | No delete handler for payments; `isWithinRetentionPeriod` util exists | — | no `deleteDuesPayment` operation | `person_id` FK is `onDelete: 'restrict'` | `fund-math` retention helpers tested | Implemented | No |
| §6 Permissions (Treasurer/President + 2FA on financial mutations) | All config/payment/refund mutations gated | Enforced on ~9 ops via `requirePosition` (2FA in prod); **absent** on 10+ ops incl. gateway + funds config | — | see §14 table | — | `dues-mutation-auth.test.ts` (covers record/confirm/reject only; no refund, no config ops) | Partially Implemented | Yes — P1 |
| §6 "List invoices — member (Own)" | Members see only own invoices | `listDuesInvoices` returns ALL org invoices + person names to any member | member dues page consumes it | route allows `association:member`; handler has no self-scoping (`listDuesInvoices.ts:30-46`) vs. `listDuesPayments.ts:26-31` which scopes correctly (PAY-02) | — | none | Missing | Yes — P1 |
| §10b Consumed: MembershipApproved → first invoice | Invoice auto-created on approval | Not implemented; approval sets `pendingPayment`, batch generator filters `active` only | — | `approveMembershipApplication.ts:66`, `generateDuesInvoicesForOrg.ts:75` | — | none | Missing | Yes — P1 `[CROSS-MODULE RISK]` |
| §10b Published events | PaymentRecorded / PaymentRefunded / InvoiceGenerated / dunning.escalation | First three emitted (`dues.payment.recorded/refunded`, `dues.invoice.generated`) and consumed in `core/domain-event-consumers.ts:74-159`; `dunning.escalation` notif type exists but nothing emits it | — | `settle-payment.ts:45`, `refundDuesPayment.ts` emit; `notification-triggers.ts:137` orphaned | — | `domain-event-consumers.test.ts` | Partially Implemented | Yes — folds into dunning P1 |
| M6-R12 Gateway adapter pattern | New gateway = adapter only | `gateway-adapter.ts` + `paymongo.adapter.ts` exist but checkout path is hardcoded to the Stripe `billing` service; PayMongo unreachable | — | `checkoutPaymentToken.ts:65`; `paymongo.adapter.ts` consumers: only test-only `handlePaymentWebhook.ts` | `gateway_provider` enum incl. `paymongo` | `gateway-adapter.test.ts` (pure) | Partially Implemented | Yes — P2 |
| §18 Feature flags (dues.onlinePayment etc.) | Flags gate checkout/dunning | No `dues.onlinePayment` / `dues.gcashDirect` / `dues.dunningV2` flag checks found in module | — | grep over module: none | — | none | Missing | P3 (Not Required for V1 if flags deferred) `[NEEDS CONFIRMATION]` |
| Special assessments (member spec §1) | SA lifecycle + apply-to-targets + collection metrics | Implemented with position checks | `officer/finances/assessments.tsx` | `createSpecialAssessment.ts`, `applySpecialAssessment.ts` (both gated) | `special_assessments` tables | 6 SA test files + `special-assessments-create-apply.hurl` | Implemented | Known TypeSpec drift (P3) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| WF-038 / AC-M06-002 | Online payment never lands in the ledger: token checkout creates no DuesPayment row; webhook metadata seam mismatch (`paymentId` absent → falls back to `pi_...` non-UUID → fund-allocation FK insert fails → dead letter); invoice never marked paid; no receipt | P0 | V1 REQUIRED | `checkoutPaymentToken.ts:73-78` vs `jobs/processStripePayment.ts:42-78`; no `createPayment` call in flow; tests mask it (`stripeWebhook.test.ts:34`) | In checkout: create a `pending` DuesPayment row and put its UUID + `orgId` in Stripe metadata. In webhook processor: mark that payment `completed`, markPaid the invoice, generate receipt, then settle — all transactional. Add a contract/integration test driving the REAL metadata shape end-to-end |
| M6-R6 / WF-045 | Receipt prefix hardcoded `'ORG'` at all 3 call sites + global unique constraint + per-org count sequence ⇒ cross-org receipt collision blocks payment recording; count-based sequence also races under concurrent recording | P0 | V1 REQUIRED | `recordDuesPayment.ts:43`, `submitPaymentProof.ts:65`, `initiateOnlinePayment.ts:52`; `dues-payments.repo.ts:244-254`; schema `dues_payment_receipt_unique` | Resolve real org code (or org short-id) per org; replace count-based sequence with a per-org/year counter table or DB sequence; add a concurrent-recording test |
| §6 / ROLE_PERMISSION_MATRIX 3.4 | `refundDuesPayment` lacks the cross-org guard every sibling mutation has — a Treasurer of org A can refund (and reverse expiry of) org B's payments by id | P0 | V1 REQUIRED | `refundDuesPayment.ts` (no `payment.organizationId !== orgId` check) vs `confirmPaymentProof.ts:47`, `markDuesInvoicePaid.ts:37`; `repo.getPayment(id)` unscoped (`dues-payments.repo.ts:174-181`); `dues-mutation-auth.test.ts` has zero refund cases | Add org guard + RBAC test mirroring confirm/reject pattern |
| §6 Permissions | No Treasurer/President check on: `updateDuesConfig`, `deleteDuesConfig`, `upsertDuesGatewayConfig`, `disconnectDuesGateway`, `testDuesGatewayConnection`, `upsertDuesFunds`, `runDunning`, `createDunningTemplate` (+ update/delete dunning templates), `recalculateAgingBucket` | P1 | V1 REQUIRED | grep counts (this audit §14); routes show only `authMiddleware({roles:["association:admin"]})`, no `requirePositionMiddleware` (`routes.ts:1124-1151,1315-1350`) | Add `@extension("x-require-position", #["Treasurer","President"])` in TypeSpec (preferred per CLAUDE.md P1.5) or inline `requirePosition`; extend `dues-mutation-auth.test.ts` |
| BR-05 | `upsertDuesFunds` performs zero validation — percentages need not sum to 100 (server-side); silent mis-allocation; only client-side check exists | P1 | V1 REQUIRED | `upsertDuesFunds.ts` (no `validateFundSplits` call; util exists at `fund-math.ts:validateFundSplits`); `funds.tsx:79` client-only | Call `validateFundSplits` and return 400 "Fund percentages must total exactly 100%" |
| §6 "List invoices — member (Own)" | Members can enumerate every org member's invoices + names + amounts | P1 | V1 REQUIRED | `listDuesInvoices.ts` (no officer check / self-scope) vs `listDuesPayments.ts:26-31` (PAY-02 pattern) | Apply the PAY-02 pattern: non-officers forced to own personId |
| WF-042 step 5 / M06-S11 | Dunning escalation is a stub: `runDunning` always returns `sent: 0` with "Future:" comment; `dunning-escalation.ts` util unwired; no dunning cron; `dunning.escalation` event never emitted | P1 | V1 RECOMMENDED | `runDunning.ts:40-52`; grep: `getDunningStageForMember`/`selectDunningTemplate` have no production callers; `jobs/index.ts` registers only reminder + webhook-retry crons | Wire `runDunning` to query overdue memberships, apply `dunning-escalation.ts` staging + exclusions, log events, emit `dunning.escalation`. Until then, surface "not yet active" in the UI to avoid a misleading journey |
| WF-038 step 1 + §10b consumed events | No reachable member entry point to online payment: reminders carry no payment link, no dashboard "Pay Now"; and no first invoice on MembershipApproved (`pendingPayment` members excluded from batch generator) | P1 | V1 REQUIRED | `jobs/reminderProcessor.ts` (no token minting); no checkout CTA in `org/$orgSlug/dues.tsx` / `my/payments.tsx`; `approveMembershipApplication.ts:66`; `generateDuesInvoicesForOrg.ts:75` (`status='active'`) | (a) Mint one-tap token in reminder emails (or link to an authenticated pay page); (b) generate first invoice on approval (event consumer) or include `pendingPayment` members in generator `[NEEDS PRODUCT DECISION on which]` |
| WF-041 step 4 | Gateway refund API never called — refunds are ledger-only; money is not returned via Stripe; no retry/notify on gateway failure | P1 | V1 REQUIRED `[NEEDS PRODUCT DECISION]` (scope: gateway-paid payments only) | `refundDuesPayment.ts` — no `billing.*refund*` call; spec §15 "Refund gateway failure → retry available" | For payments with gateway provenance, call billing refund API before ledger reversal; manual payments stay negative-entry-only per spec |
| WF-041 | Over-refund unguarded: repeated partial refunds can reverse more than paid; `refund-validation.ts` (window/threshold/eligibility) has no production consumers | P1 | V1 RECOMMENDED | `refundDuesPayment.ts:43-46` (`refundAmount` unchecked vs remaining); `refund-validation.ts` unwired | Validate `refundAmount <= amount - refundedAmount` (+ wire `validateRefundEligibility`) |
| §8 / §15 24h webhook timeout | `pending → expired` never happens; treasurer never notified | P2 | V1 RECOMMENDED | enum-only usage; no job; `expired_at` column never written | Add interval job: pending payments older than 24h → `expired` + treasurer notification (depends on P0 #1 creating pending rows) |
| M6-R4 / AC-M06-004 | Duplicate-recording warning returned only AFTER payment creation; frontend ignores `meta.concurrentWarning` entirely | P2 | V1 RECOMMENDED | `recordDuesPayment.ts:37,122`; `record-payment-form.tsx` (no reference) | Pre-check endpoint or two-phase confirm; at minimum surface the returned warning as a toast |
| M6-R8 | Idempotency keyed on Stripe `event.id`, not `gateway_transaction_id`; two distinct events for the same intent would double-settle (double expiry extension + duplicate allocations) | P2 | V1 RECOMMENDED | `stripeWebhook.ts:29`; `processStripePayment.ts` settle not idempotent per intent | Key (also) on payment-intent id, or make settlement idempotent per paymentId |
| AC-M06-003 | Token expiry 72h vs spec 30 days; token consumed at checkout initiation so abandoned checkout burns the link and then reports "already been completed" | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `utils/payment-token.ts:10`; `checkoutPaymentToken.ts:41-43,82`; `validatePaymentToken.ts:41-43` | Decide canonical expiry; consume token on payment confirmation (webhook) instead of checkout creation, or allow re-checkout of unused sessions |
| AC-M06-007 | Life-member payment block missing everywhere (checkout, sendPaymentLink, recordDuesPayment) | P2 | V1 RECOMMENDED | grep `life|2099` over module: zero hits | Block checkout/link-mint for life members with spec message |
| M6-R12 / BR-30 | PayMongo configurable (`gateway_provider` enum) but checkout hardcodes Stripe billing service and passes `publicKey` as `connectedAccountId`; orgs configured with PayMongo silently fail | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` (is PayMongo V1?) | `checkoutPaymentToken.ts:65-68`; `paymongo.adapter.ts` unreachable | Either gate provider choice to `stripe` until adapter wired, or route checkout through `gateway-adapter.ts` |
| WF-041 partial refund | Per-allocation `Math.round(amount * ratio)` reversal can drift from `refundAmount` (centavo leak across funds); partial refund never reverses expiry (spec ambiguous) | P2 | V1 RECOMMENDED | `membership-lifecycle.ts:193-201` | Last-fund-absorbs pattern for reversals (reuse `allocateFunds`); product decision on partial-refund expiry `[NEEDS PRODUCT DECISION]` |
| Proof confirm atomicity | `confirmPaymentProof` settles OUTSIDE any transaction before the status update; failure between leaves expiry extended with payment stuck `submitted`; invoice markPaid failures swallowed | P2 | V1 RECOMMENDED | `confirmPaymentProof.ts:55-83` (no `db.transaction`, bare `catch {}`) | Wrap settle + status + invoice markPaid in one transaction (mirror `recordDuesPayment`) |
| Contract coverage | 64% (32/50) of `Member/DuesSpecialAssessments` ops contract-covered; uncovered: config CRUD, invoice CRUD, proof confirm/reject, refund flow, SA update/delete/list | P2 | V1 RECOMMENDED | MODULE_SPEC.member.dues-special-assessments §7 | Prioritize refund + proof-confirm Hurl scenarios (they guard the financial mutations) |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| 5 untyped test-only helper handlers (`generatePaymentLink`, `generatePaymentReceipt`, `handlePaymentWebhook`, `initiateOnlinePayment`, `validatePaymentLink`) — not registered on any route | files in `member/duesspecialassessments/`; cutover spec §2 marks them "test-helper; not registered" | Documented in cutover spec as legacy | Confusion: `initiateOnlinePayment` is the only code that creates pending payments + receipts for online flow, yet is unreachable | Keep but do not expand; when fixing P0 #1, either salvage `initiateOnlinePayment` logic into the registered flow or delete the helpers `[DO NOT OVERBUILD]` |
| `getDuesMetrics` aggregate endpoint | `getDuesMetrics.ts`, route `/association/member/dues-metrics` | Not in m06 API table; in cutover spec inventory | Low | Keep |
| `recalculateAgingBucket` manual recompute endpoint | `recalculateAgingBucket.ts` | Aging report is specced; manual recompute trigger is not | Low (but ungated — see §14) | Keep but gate to Treasurer/President |
| Webhook manual-retry path with `actorRole` string check (`'treasurer' || 'admin'`) | `webhookRetryProcessor.ts:129-158` | Spec mentions treasurer manual retry in code comment only | Role check by raw string, not `requirePosition`; no registered route calls it `[NEEDS CONFIRMATION]` | Keep but clarify; wire through real RBAC if exposed |
| `billing.tsp` duplicate `handleStripeWebhook` generated route (dead — hand-wired registration wins) | cutover spec §7; `app.ts:389` | Documented tech debt | Contract surface confusion | Consider removal later (separate billing-module ticket) `[SHARED DEPENDENCY]` |
| Payment-proof review flow (submit/confirm/reject + storage proof fields) | `submitPaymentProof.ts` etc.; enum statuses | m06 §8 includes the statuses; flow detail richer than spec | Low | Keep — aligns with PH bank-transfer reality |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Manual payment recording (WF-044) | Treasurer | Officer records offline payment | validate → receipt → invoice markPaid → fund split → expiry extend → status recompute | Implemented (transactional) | Receipt-prefix P0; duplicate-warning P2 | `recordDuesPayment.ts` |
| Online one-tap payment (WF-038) | Member | Payment link (email) | validate token → checkout → Stripe → webhook → settle → receipt | Broken at webhook seam; no ledger record; no member entry points | Yes — P0 + P1 | `checkoutPaymentToken.ts` / `processStripePayment.ts` |
| Proof-based payment (PH bank transfer) | Member + Treasurer | Member submits proof | submit (status `submitted`) → officer confirm/reject → settle on confirm | Implemented; confirm not transactional | P2 atomicity | `submitPaymentProof.ts`, `confirmPaymentProof.ts` |
| Refund (WF-041) | Treasurer | Officer initiates | validate → gateway refund → reverse allocations → reverse expiry → recompute | Ledger-only; no gateway call; no org guard; over-refund possible | Yes — P0/P1 | `refundDuesPayment.ts` |
| Invoice lifecycle | Treasurer / System | Config cycle or manual | create/generate → sent → paid/overdue/cancelled/writtenOff | Implemented (manual + org-wide batch); no auto-first-invoice on approval; batch skips `pendingPayment` members | Yes — P1 | `generateDuesInvoicesForOrg.ts:75` |
| Reminders (WF-042a) | System | Daily cron | match schedule offsets → dedup → notify | Implemented | Reminder lacks payment link (P1 folded above) | `jobs/reminderProcessor.ts`, `jobs/index.ts:19` |
| Dunning escalation (WF-042b) | System/Treasurer | Overdue threshold | stage selection → template → event log → escalated notification | Stub | Yes — P1 | `runDunning.ts:40-52` |
| Financial reporting (WF-043) | Treasurer | Dashboard/report request | dashboard stats, collection/fund/aging reports | Implemented | Minor | `getDuesDashboard.ts`, `generateDuesReport.ts` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| WF-038.1 reminder contains one-tap link | Reminder email carries `/pay/:token` URL | Missing | `reminderProcessor.ts` creates plain notifications | V1 REQUIRED | Officer `sendPaymentLink` is the only mint path |
| WF-038.3-4 checkout redirect | Stripe session created, member redirected | Implemented | `checkoutPaymentToken.ts` | — | Stripe-only |
| WF-038.5 "Processing…" polling after redirect | Frontend polls until webhook confirms | Missing | `pay/$token.tsx` re-validates token only; used-token shows "already paid" regardless of actual payment outcome | V1 RECOMMENDED | Depends on P0 #1 |
| WF-038.6 webhook settles payment | completed + expiry + funds + receipt | Partially Implemented (broken seam) | `processStripePayment.ts:44` | V1 REQUIRED | P0 #1 |
| WF-038.exc webhook never arrives (24h) | status → expired, treasurer notified | Missing | no job sets `expired` | V1 RECOMMENDED | P2 |
| WF-039 all steps | ordered split, last absorbs, invariant | Implemented | `allocateFunds`, `listFunds` orderBy sortOrder | — | Solid |
| WF-040 config set/update | Treasurer-gated config CRUD | Partially Implemented | update/delete ungated | V1 REQUIRED | P1 |
| WF-041.3-7 refund reversal | expiry reversal + proportional reversal + recompute | Partially Implemented | full-refund expiry reversal ✓; gateway call ✗; over-refund ✗ | V1 REQUIRED | |
| WF-042.1-4 reminder matching + dedup | schedule offsets, log-based dedup | Implemented | `duesReminderLogs` dedup | — | Life members naturally excluded (2099 expiry never matches) `[INFERRED]` |
| WF-042.5 escalation | dunning templates fire past threshold | Missing | stub | V1 RECOMMENDED | |
| WF-045 receipt | unique number, downloadable | Partially Implemented | `downloadReceipt` works (HTML receipt); numbering broken cross-org | V1 REQUIRED | Spec says PDF; impl is HTML `[NEEDS CONFIRMATION]` |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Record manual payment | Treasurer | Full settle pipeline | Implemented | Receipt P0 | V1 REQUIRED | `recordDuesPayment.ts` |
| Pay online via emailed link | Member | No-login checkout completes ledger | Partially Implemented | Yes (P0) | V1 REQUIRED | §5 row 1 |
| Pay online from dashboard | Member | "Pay Dues" CTA → checkout | Missing | Yes | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | no CTA in `dues.tsx`/`my/payments.tsx`; `initiateOnlinePayment` unregistered |
| Submit payment proof (bank transfer) | Member | Upload proof, await review | Implemented | Atomicity P2 | V1 REQUIRED | `submitPaymentProof.ts` |
| Review/confirm/reject proofs | Treasurer | Queue + confirm/reject with reason | Implemented | — | V1 REQUIRED | `listPendingProofs.ts`, confirm/reject handlers |
| Refund payment | Treasurer | Gateway + ledger reversal | Partially Implemented | Yes (P0/P1) | V1 REQUIRED | `refundDuesPayment.ts` |
| Configure dues amounts/cycle/grace | Treasurer | Gated config CRUD + overrides | Partially Implemented | Permission gap | V1 REQUIRED | `updateDuesConfig.ts` |
| Configure fund splits | Treasurer | Validated 100% splits | Partially Implemented | Validation + permission | V1 REQUIRED | `upsertDuesFunds.ts` |
| Connect/test payment gateway | Treasurer | Encrypted credentials, test connection | Partially Implemented | Permission gap; PayMongo unwired | V1 REQUIRED | `upsertDuesGatewayConfig.ts` |
| Generate invoices for org | Treasurer | Batch generation incl. new members | Partially Implemented | Excludes `pendingPayment` | V1 REQUIRED | `generateDuesInvoicesForOrg.ts:75` |
| View own payment history + receipts | Member | Self-scoped list + receipt download | Implemented | — | V1 REQUIRED | `listDuesPayments.ts` (PAY-02), `my/payments.tsx` |
| View own invoices only | Member | Self-scoped | Missing (sees all) | Yes (P1) | V1 REQUIRED | `listDuesInvoices.ts` |
| Financial dashboard + reports | Treasurer | Collection/fund/aging | Implemented | — | V1 REQUIRED | `getDuesDashboard.ts` |
| Automated reminders | System | Scheduled, deduped | Implemented | No pay link | V1 REQUIRED | `reminderProcessor.ts` |
| Dunning escalation | System | Staged escalation | Missing (stub) | Yes (P1) | V1 RECOMMENDED | `runDunning.ts` |
| Special assessments | Treasurer | Create/apply/track | Implemented | TypeSpec drift P3 | V1 REQUIRED | SA handlers + tests |
| Multi-currency dues | Org | Beyond PHP | Not Required for V1 | — | V2 DEFERRED | PHP default hardcoded |
| GCash direct integration | Member | Bypass PayMongo | Not Required for V1 | — | V2 DEFERRED | flag `dues.gcashDirect` default false |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| Online payment never recorded in ledger (webhook metadata seam; no DuesPayment row; fund-allocation insert with non-UUID `pi_...` id; invoice never marked paid; no receipt) | API/backend/jobs | P0 | V1 REQUIRED | `checkoutPaymentToken.ts:73-78`, `processStripePayment.ts:44`, tests masking with synthetic metadata (`stripeWebhook.integration.test.ts:111-114`) `[NEEDS CONFIRMATION]` on exact runtime error only | Members who pay real money get no receipt, stay unpaid in records, invoice stays open; webhooks dead-letter; AC-M06-001/002, BR-06/07 chain broken for the flagship flow | Create pending payment at checkout; carry payment UUID in metadata; webhook completes payment + invoice + receipt + settle transactionally; end-to-end test with real metadata shape |
| Cross-org refund possible (no org guard on `refundDuesPayment`) | Security/financial | P0 | V1 REQUIRED | `refundDuesPayment.ts` vs `confirmPaymentProof.ts:47`; `getPayment` unscoped | Any org's treasurer can reverse another org's payments and member expiry — financial integrity + tenant isolation breach (BR-30 spirit) | Add `payment.organizationId !== ctx.organizationId → 403` + RBAC test |
| Cross-org receipt-number collision (hardcoded `'ORG'` prefix + global unique + per-org count) | Data/schema | P0 | V1 REQUIRED | `recordDuesPayment.ts:43`, schema `dues_payment_receipt_unique`, `getNextReceiptSequence` count-based | Second org's first payment of the year fails with a DB unique violation → blocks WF-044 in any multi-org deployment (the platform's main deployment mode); concurrency race even within one org | Real org code in prefix + counter table/sequence per org/year |
| 10+ financial mutations missing Treasurer/President + 2FA gate | RBAC | P1 | V1 REQUIRED | §14 table; `routes.ts` middleware chains | Gateway credentials, dues amounts, fund splits mutable by any `association:admin`-role member of the org — violates ROLE_PERMISSION_MATRIX 3.4 | x-require-position extensions + regen + tests |
| `upsertDuesFunds` accepts splits that don't sum to 100 | API/backend | P1 | V1 REQUIRED | `upsertDuesFunds.ts` (no validation); `validateFundSplits` exists unused | BR-05 violated server-side; silent mis-allocation of every later payment | Wire `validateFundSplits`; 400 on violation |
| Members can list all org invoices (PII + amounts) | RBAC/privacy | P1 | V1 REQUIRED | `listDuesInvoices.ts:30-46`; route roles `routes.ts:1182` | Financial privacy leak across the whole org membership | Apply PAY-02 self-scoping pattern |
| No reachable member payment entry point + no first invoice on approval | Workflow/cross-module | P1 | V1 REQUIRED | `reminderProcessor.ts` (no links), no Pay CTA, `approveMembershipApplication.ts:66`, `generateDuesInvoicesForOrg.ts:75` | Join → pay → active funnel requires manual officer action per member; new members stuck `pendingPayment` | Reminder links + invoice generation for approved members `[CROSS-MODULE RISK]` m05/m07 |
| Refund never calls gateway; over-refund unguarded; `refund-validation.ts` unwired | API/backend | P1 | V1 REQUIRED | `refundDuesPayment.ts:43-46`; util has no consumers | Gateway-paid money not actually returned; books can show refunds exceeding receipts | Gateway refund for gateway payments; cap refundAmount at remaining; wire eligibility util |
| Dunning escalation stub presented as working | Workflow/trust | P1 | V1 RECOMMENDED | `runDunning.ts:40-52` ("Future:" comment, `sent=0`) | Treasurer runs dunning, sees success-shaped response, nothing was sent — misleading journey | Implement or visibly disable |
| 24h pending→expired timeout missing | Backend/jobs | P2 | V1 RECOMMENDED | enum never set | Pending payments hang forever; treasurer never alerted | Interval job (after P0 #1) |
| Duplicate-recording warning after-the-fact + ignored by UI | UI/API | P2 | V1 RECOMMENDED | `recordDuesPayment.ts:122`, `record-payment-form.tsx` | AC-M06-004 "proceeds only if confirmed" not met; convention-desk double entry risk | Pre-check + confirm UX |
| Webhook idempotency on event.id not transaction id; settle not idempotent | Backend | P2 | V1 RECOMMENDED | `stripeWebhook.ts:29` | Distinct Stripe events for same intent → double expiry extension/allocations | Key per intent or idempotent settle |
| Token 72h vs spec 30d; consumed on checkout initiation | Backend/UX | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `payment-token.ts:10`, `checkoutPaymentToken.ts:82` | Abandoned checkout burns the link with a false "already completed" message | Decide expiry; consume on confirmation |
| Life-member payment block missing | Backend | P2 | V1 RECOMMENDED | grep zero hits | AC-M06-007 unmet; life members can be charged | Block at link-mint + checkout + record |
| PayMongo configurable but unreachable; `publicKey` used as Stripe `connectedAccountId` | Backend/integration | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `checkoutPaymentToken.ts:65-68` | PH-market gateway promised by spec silently broken if selected | Gate provider or wire adapter |
| `confirmPaymentProof` non-transactional settle; swallowed invoice errors | Backend | P2 | V1 RECOMMENDED | `confirmPaymentProof.ts:55-83` | Partial-failure leaves expiry extended with payment stuck `submitted` | Single transaction |
| Partial-refund reversal rounding drift | Backend | P2 | V1 RECOMMENDED | `membership-lifecycle.ts:197` | Centavo drift violates allocation-invariant spirit on reversals | Last-fund-absorbs reversal math |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Member clicks emailed pay link → pays → success + receipt | Webhook confirms; receipt downloadable; dues current | Stripe charge succeeds but no payment record/receipt/invoice update; on return, used token shows "already been completed" whether or not payment succeeded | `pay/$token.tsx:38,85`; `validatePaymentToken.ts:41-43`; P0 #1 chain | P0 | Integration test: real checkout metadata → webhook → assert DuesPayment row + invoice paid + receipt + expiry |
| Member abandons Stripe checkout, retries link | Can retry payment | Token already consumed at checkout initiation → "This payment has already been processed" | `checkoutPaymentToken.ts:41-43,82` | P2 | Unit: abandoned checkout → re-validate token behavior |
| Treasurer runs dunning | Overdue members get escalated notices | `{evaluated: N, sent: 0}` always; nothing sent | `runDunning.ts:40-52` | P1 | Backend test: overdue member + active template → event logged + notification |
| Treasurer of org A refunds payment id from org B | 403 | Refund processed; org B member's expiry reversed | `refundDuesPayment.ts` | P0 | RBAC test in `dues-mutation-auth.test.ts` |
| Second org records its first payment of the year | Receipt `ORGB-2026-000001` | Unique-violation error (collides with org A's `ORG-2026-000001`) | `recordDuesPayment.ts:43` + global unique | P0 | Two-org receipt test |
| Member opens org dues page wanting to pay online | "Pay Now" per WF-038 | View-only invoices/payments; no checkout CTA | `org/$orgSlug/dues.tsx`, `my/payments.tsx` | P1 | E2E once entry point exists |
| Two treasurers record same member within 5 min | Second sees confirm dialog before creation | Both recorded silently; warning in response ignored by UI | `record-payment-form.tsx` | P2 | Component test: warning surfaced |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `dunning-escalation.ts` (stage/template/exclusion logic) | service not called | no production consumers (grep) | Escalation appears tested but never runs | Wire into `runDunning` (P1 fix) |
| `refund-validation.ts` (`validateRefundEligibility`, `requiresApproval`) | service not called | no production consumers | Over-refund/window rules exist but unenforced | Wire into `refundDuesPayment` |
| `initiateOnlinePayment.ts`, `generatePaymentLink.ts`, `generatePaymentReceipt.ts`, `handlePaymentWebhook.ts`, `validatePaymentLink.ts` | handlers not registered | cutover spec §2 "test-helper; not registered" | Confusion; `initiateOnlinePayment` contains the missing pending-payment logic | Salvage or delete during P0 #1 fix |
| `paymongo.adapter.ts` + `gateway-adapter.ts` | adapter not wired to checkout | only test-only `handlePaymentWebhook` imports paymongo | M6-R12 unrealized | Wire or defer with provider gating |
| `dues.onlinePayment` / `dues.gcashDirect` / `dues.dunningV2` feature flags | spec'd flags absent in code | grep: none | Spec/impl drift | `[NEEDS CONFIRMATION]` whether flags are V1 |
| `dunning.escalation` notification type + trigger | event never emitted | `notification-triggers.ts:137` orphaned | Dead delivery path | Activates with dunning fix |
| billing.tsp `handleStripeWebhook` generated route | dead route (hand-wired wins) | cutover spec §7; `app.ts:389` | Contract confusion | Remove from billing.tsp later `[SHARED DEPENDENCY]` |
| `expiredAt` column + `expired` enum value | schema saved but never written | no writer | Dead state | Activates with 24h-timeout fix |
| `bulkRecordPayments` (referenced by CLAUDE.md + MODULE_SPEC.dues §7) | nonexistent code referenced by docs | grep: zero hits in codebase | Doc drift misleads contributors | Doc sync (P3) |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `receipt_number` unique globally, generated per-org with constant prefix | schema/model + backend | `dues-payments.schema.ts` (`dues_payment_receipt_unique`), `dues-payments.repo.ts:244-254` | P0 | Per-org sequence + real org code (or scope unique to org+number) |
| Count-based receipt sequence races under concurrency | backend | `getNextReceiptSequence` = `count(*)+1`, read outside the insert race window | P0 (folded) | Counter table / DB sequence |
| Fund allocation insert would receive non-UUID `paymentId` from webhook fallback | backend/jobs | `processStripePayment.ts:44` | P0 (folded) | Carry payment UUID in metadata |
| `dues_reminder_schedule` shape diverges from spec entity (single `daysOffset` + channel booleans vs `daysBefore`/`daysAfter` + channel enum incl. sms/letter) | schema vs spec | `dues-payments.schema.ts` vs m06 §7 | P3 | Spec sync; sms/letter channels are V2 `[DO NOT OVERBUILD]` |
| `validatePaymentToken` returns `dueDate: token.expiresAt` (token expiry mislabeled as invoice due date) | API | `validatePaymentToken.ts:57` | P3 | Rename field or return invoice dueDate |
| `runDunning` honors `body.organizationId || ctx.orgId` — body can point at another org's templates | API | `runDunning.ts:31` | P2 | Drop body override or enforce equality |
| `applySpecialAssessment` returns `{message, invoicesCreated, skipped}` vs TypeSpec `ApplySpecialAssessmentResult{assessment, invoicesGenerated}` | API contract drift | cutover spec §7; `applySpecialAssessment.ts:91-92` | P3 | Pick winning shape (existing ticket) |
| Dues schemas split across `handlers/dues/repos/` (canonical) + `association:member/repos/` (canonical for dunning/SA/history) + 3 re-export shims | schema topology | cutover spec §3; audit-index §18 "orphan dues repos" | P3 | Shim cleanup wave when seeds rewrite imports `[SHARED DEPENDENCY]` |
| `dues_payment.invoice_id` has no FK reference (plain uuid) | schema | `dues-payments.schema.ts` (`invoiceId: uuid('invoice_id')` bare) | P3 | Consider FK once invoice table location stabilizes `[NEEDS CONFIRMATION]` |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `refundDuesPayment`: no cross-org payment ownership check | Treasurer / tenant isolation | `refundDuesPayment.ts`; unscoped `getPayment` | P0 | Org guard + test |
| No `requirePosition` on `updateDuesConfig`, `deleteDuesConfig`, `upsertDuesGatewayConfig`, `disconnectDuesGateway`, `testDuesGatewayConnection`, `upsertDuesFunds`, `runDunning`, `createDunningTemplate` (and per pattern likely update/delete dunning template), `recalculateAgingBucket` | Treasurer/President + 2FA | grep counts this audit; `routes.ts:1124-1151,1315-1350` show no `requirePositionMiddleware` | P1 | x-require-position extensions; extend `dues-mutation-auth.test.ts` (currently covers record/confirm/reject only) |
| `listDuesInvoices` exposes all org invoices to plain members | member Own-only | `listDuesInvoices.ts` vs `listDuesPayments.ts:26-31` | P1 | PAY-02 self-scoping |
| `sendPaymentLink` gated by `requireOfficerMiddleware()` (any officer), spec implies treasurer-level financial action | officer scope | `routes.ts:3120-3123` | P2 | `[NEEDS PRODUCT DECISION]` — any officer may be acceptable |
| 2FA enforcement on privileged positions skipped outside production (`NODE_ENV !== 'production'`) | 2FA | `officer-checks.ts:103-104` | P3 | By design; note for prod-parity tests |
| Webhook manual-retry role check uses raw `actorRole` string, no route wiring found | webhook ops | `webhookRetryProcessor.ts:131` | P3 | Clarify exposure path |
| Public token endpoints leak member name/org/amount to anyone holding a token URL | public surface | `validatePaymentToken.ts:50-58` | P3 | Acceptable (token = credential); ensure tokens never logged |
| Gateway credentials encrypted at rest (AES-GCM) and stripped from responses — earlier "plaintext-at-rest" note now FIXED | credentials | `core/gateway.ts:171-179`, `upsertDuesGatewayConfig.ts:56-58` | — | Update cutover spec §7 |

## 15. Record Safety / Audit History Findings

Module handles financial records (BIR 7-year retention).

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Payment status transitions are persisted to `dues_payment_status_history` on every `updatePaymentStatus` with state-machine assertion — good | payment audit trail | `dues-payments.repo.ts:188-214`, `status-transitions.ts:87-98` | — | Keep |
| Online payments that succeed at Stripe leave NO financial record at all (no payment row, no history, no receipt) | financial ledger completeness | P0 #1 | P0 (folded) | Fix the seam — this is also a BR-32 retention problem: a real money movement with zero record |
| No hard-delete path for payments (BR-32 satisfied); invoices ARE hard-deletable via `deleteDuesInvoice` (unpaid only — verify) | retention | no `deleteDuesPayment`; `deleteDuesInvoice.ts` exists | P3 | `[NEEDS CONFIRMATION]` that paid invoices can't be deleted; prefer cancel/writtenOff statuses |
| x-audit middleware present on all financial mutations inspected (create/update audit actions in route chains) + webhook audits via `auditAction` | audit events | `routes.ts` audit middleware lines; `stripeWebhook.ts:89-96` | — | Keep |
| Refund reason persisted (`refundReason`), proof rejection reason persisted | justification capture | schema fields + `updatePaymentStatus` reason plumbing | — | Keep |

## 16. Knowledge Graph Findings

KG (2026-06-06, `.understand-anything/knowledge-graph.json`) used as secondary evidence; all wiring claims below re-verified by direct inspection because the graph predates recent commits.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Dues domain spans 3 handler dirs: logic in `member/duesspecialassessments/`, canonical schemas split between `handlers/dues/repos/` and `association:member/repos/`, plus re-export shims | verified by `find`/imports; matches audit-index §18 "orphan dues repos" | Contributors following CLAUDE.md/MODULE_SPEC.dues land in the wrong directory | Doc sync + shim cleanup (P3) |
| `settle-payment.ts` is the load-bearing seam: consumed by recordDuesPayment, confirmPaymentProof, processStripePayment; delegates to `member/membership/utils/membership-lifecycle` (cross-module import into membership) | imports verified | Any settle fix has membership blast radius | `[CROSS-MODULE RISK]` — coordinate with membership-lifecycle audit |
| `core/domain-event-consumers.ts` holds 4 dues hooks (`payment.recorded`, `payment.refunded`, `invoice.generated`, `payment.proof.rejected`) importing schemas at old paths | `domain-event-consumers.ts:43-46,74-166` | Expiry update happens twice (inline in settle + via event consumer) — idempotent but redundant | Note for fix sequencing; do not remove consumer without checking webhook path |
| Hand-wired `/webhooks/stripe` registered at `app.ts:389` before auth; HAND_WIRED_ROUTES.yaml line 47 entry present (owner listed as `billing` though handler lives in dues) | verified | Ownership ambiguity for webhook fixes | Update yaml owner during fix |
| Frontend consumers: 26 dues-related routes in memberry; zero in admin app | route `find` | Dues is entirely org/member-side; national rollups (m14) out of scope here | — |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| The PH-market reality (bank transfer + proof review) is well covered; the "modern" gateway flow is the broken one | proof flow complete vs P0 #1 | V1 pilot could survive on manual + proof flows, but the spec's flagship one-tap flow is the conversion driver | Prioritize P0 #1 |
| m09↔m06 training payment gate (flagged unclear in domain status) routes through billing/event registration, not through these dues handlers | no training imports in dues module | Boundary is clean from dues side | Cover in training-credits audit |
| Membership status is downstream of every dues mutation via `persistWithComputedStatus` | `membership-lifecycle.ts:172,219` | Dues bugs corrupt member standing (grace/lapsed) — why cross-org refund is P0 | Tests must assert membership side-effects |
| Life membership exemption is a domain rule (2099 expiry) with no enforcement anywhere in dues | grep | Spec AC unmet | P2 fix |
| `dues_payment_status` proof statuses (`submitted/underReview/confirmed/rejected`) — m06 §8 note "not yet validated against handler code" is now resolved: handlers implement submit→confirm/reject (skipping `underReview` as a required stop) | `confirmPaymentProof.ts:39-44`, state machine | Spec note can be closed | Spec sync P3 |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No new evidence files saved. Existing Playwright specs were inspected statically only:

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| `officer/payment-expiry.spec.ts` tests BR-07 expiry *extension*, not the 24h payment-expiry timeout — name suggests coverage that doesn't exist | Playwright (inspected, not run) | `apps/memberry/tests/e2e/officer/payment-expiry.spec.ts:12-22` | False confidence on WF-038 exception path | Add real expiry-timeout test when job exists |
| No E2E exercises the public `/pay/:token` journey end-to-end (token validate→checkout→return states) | Playwright | no spec under `tests/e2e/` hits `/pay/` (14 dues specs reviewed) | Flagship flow unguarded at UI level | Add after P0 #1 fix |
| 14 dues E2E specs concentrate on officer flows (record, refund UI, reminders, reconciliation, correction) + member view states | Playwright | `tests/e2e/{officer,member,journeys,states,actions,cross-persona}/` | Good officer-side depth | Keep |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `recordDuesPayment.test.ts`, `markDuesInvoicePaid.test.ts`, `getDuesPayment.test.ts`, `listDuesPayments.test.ts`, `refundDuesPayment.test.ts` | backend/unit | Manual payment + invoice + refund handler logic | Medium-High |
| `dues-mutation-auth.test.ts` | permission/RBAC | Auth on record/confirm/reject — NO refund, NO config/gateway/funds ops | Medium (scope-limited) |
| `stripeWebhook.test.ts`, `stripeWebhook.integration.test.ts` | backend/integration | Signature verify, dispatch, retry — with synthetic metadata (masks P0 #1) | Low for end-to-end correctness, High for retry mechanics |
| `checkoutPaymentToken.test.ts`, `validatePaymentToken.test.ts`, `sendPaymentLink.test.ts`, `downloadReceipt.test.ts` | backend/unit | Token lifecycle, receipt download | High |
| `dues-config.test.ts`, `dues-config-handlers.test.ts`, `dues-gateway-config.test.ts`, `getDuesConfig.test.ts` | backend/unit | Config CRUD + gateway config | Medium |
| `dunning.test.ts`, `dunning-escalation.test.ts` (utils) | backend/unit | Template CRUD + pure escalation functions (never wired) | Low (tests logic that production never executes) |
| `generateDuesInvoicesForOrg.test.ts`, `createDuesInvoice.test.ts`, `deleteDuesInvoice.test.ts`, `getDuesInvoice.test.ts` | backend/unit | Invoice lifecycle | Medium |
| `applySpecialAssessment.test.ts`, `createSpecialAssessment.test.ts`, `updateSpecialAssessment.test.ts`, `deleteSpecialAssessment.test.ts`, `listSpecialAssessments.test.ts`, `getSpecialAssessmentCollection.test.ts` | backend/unit | SA lifecycle | High |
| `settle-payment.test.ts`, `receipt-number.test.ts`, `refund-validation.test.ts`, `reminder-schedule.test.ts`, `gateway-adapter.test.ts`, `dues-payments.repo.test.ts`, `dues-schema.test.ts`, `dues.repo.test.ts` (association:member) | backend/unit | Utils + repos (receipt format only — not collision; refund-validation unwired) | Medium |
| 18 Hurl files (`assoc-dues-*`, `dues-*`, `dunning-*`, `gateway-config-flow`, `aging-buckets-flow`, `payment-token-validate`, `special-assessments-create-apply`, `dues-stripe-webhook`) | contract | 64% op coverage (32/50) per cutover spec §7 | Medium |
| 14 Playwright specs (see §18) | E2E | Officer record/refund/reminders/reconciliation; member dues views; cross-persona receipt | Medium |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Webhook end-to-end with REAL checkout metadata shape (`paymentTokenId`/`organizationId`, no `paymentId`) asserting payment row + invoice paid + receipt + expiry | integration | Reproduces P0 #1; current tests mask it | Before (RED first) |
| Cross-org refund 403 (treasurer of org A vs org B payment) | permission/RBAC | Reproduces P0 #2 | Before |
| Two-org receipt collision + concurrent same-org recording | backend/unit + data | Reproduces P0 #3 | Before |
| RBAC matrix for config/gateway/funds/dunning ops (non-treasurer member with `association:admin` role → 403) | permission/RBAC | Locks P1 permission fixes | Before |
| `upsertDuesFunds` rejects splits ≠ 100% | backend/unit | BR-05 server-side | Before |
| `listDuesInvoices` member self-scoping | permission/RBAC | P1 privacy fix | Before |
| Dunning run creates events + notifications for overdue member matching template | backend/unit + domain workflow | Converts stub to real | Before |
| First-invoice-on-approval (or generator includes `pendingPayment`) | integration (cross-module) | P1 funnel fix | During |
| Over-refund rejection (partial then full > remaining) | backend/unit | P1 refund guard | Before |
| 24h pending→expired job + treasurer notification | backend/unit | P2 | During |
| `/pay/:token` E2E (valid → checkout → success/cancel/expired/used states) | E2E/Playwright | Flagship journey UI guard | After P0 #1 |
| Refund + proof-confirm Hurl scenarios (contract coverage gap list from cutover spec §7) | contract | Coverage 64% → financial mutations unguarded at contract level | During |
| Partial-refund reversal sum invariant | backend/unit | P2 rounding drift | During |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `member/membership/utils/membership-lifecycle.ts` (settle/refund/expiry/status) | cross-module | imported by settle-payment + refund + markPaid | Dues fixes mutate membership status logic | `[CROSS-MODULE RISK]` — coordinate with membership-lifecycle gap plan |
| `core/billing` service (Stripe) + `handlers/billing` webhook signature verify | shared/platform | `stripeWebhook.ts`, `checkoutPaymentToken.ts` | Gateway refund fix needs billing API surface | `[SHARED DEPENDENCY]` — verify billing exposes refund for connected accounts |
| `core/domain-event-consumers.ts` dues hooks | shared/platform | lines 74-166 | Event-side expiry update duplicates inline settle | `[SHARED DEPENDENCY]` — don't double-fix |
| Schemas at `handlers/dues/repos/` + `association:member/repos/` + shims; seeds import via shims | database/schema | cutover spec §2/§3 | Receipt-number fix likely needs a migration (counter table or per-org unique) | `[SHARED DEPENDENCY]` — flag to future prompt-06 DB audit |
| `approveMembershipApplication` (m05) for first-invoice trigger | cross-module | `approveMembershipApplication.ts` | Funnel fix touches membership module | `[CROSS-MODULE RISK]` + `[NEEDS PRODUCT DECISION]` on trigger design |
| `communication`/`email`/`notifs` for reminder links + dunning notifications | cross-module | `reminderProcessor.ts` createNotification seam | Reminder-link fix spans m07/m22 | `[CROSS-MODULE RISK]` |
| `association:admin` role grant semantics (Better-Auth `user.role`) | product decision | `middleware/auth.ts` role check | Determines real blast radius of missing position checks | `[NEEDS CONFIRMATION]` — trace who receives this role |
| TypeSpec regen pipeline (x-require-position extensions) | environment/tooling | `specs/api` build + `generate.ts` | Permission fixes should go through extensions, not hand-edits | Standard regen workflow |

## 22. Raw Recommended Fix Ideas

This section is not the final fix order.

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Create pending DuesPayment at token checkout; carry payment UUID + orgId in Stripe metadata; webhook completes payment/invoice/receipt/settle in one tx | P0 #1 | P0 | V1 REQUIRED | integration w/ real metadata | Salvage logic from unregistered `initiateOnlinePayment.ts` |
| Add org guard to `refundDuesPayment` (mirror confirm/reject) | P0 #2 | P0 | V1 REQUIRED | RBAC test | 3-line fix + test |
| Real org-code receipt prefix + per-org/year counter table (migration) | P0 #3 | P0 | V1 REQUIRED | collision + concurrency tests | `[SHARED DEPENDENCY]` migration |
| x-require-position on 10 ungated ops (TypeSpec extensions + regen) | P1 RBAC | P1 | V1 REQUIRED | RBAC matrix test | Batchable in one TypeSpec pass |
| `validateFundSplits` in `upsertDuesFunds` | BR-05 | P1 | V1 REQUIRED | unit | Util already exists |
| Self-scope `listDuesInvoices` for non-officers | privacy | P1 | V1 REQUIRED | RBAC | Copy PAY-02 pattern |
| Implement `runDunning` body using existing `dunning-escalation.ts` + emit `dunning.escalation` | dunning stub | P1 | V1 RECOMMENDED | workflow test | Logic + tests already written, just unwired |
| Cap refund at remaining amount; wire `validateRefundEligibility`; gateway refund call for gateway-paid payments | refund gaps | P1 | V1 REQUIRED | over-refund + gateway-mock tests | Gateway part `[SHARED DEPENDENCY]` billing |
| First-invoice on MembershipApproved (or include `pendingPayment` in generator) + payment link in reminder notifications | funnel | P1 | V1 REQUIRED | cross-module integration | `[NEEDS PRODUCT DECISION]` on mechanism |
| 24h pending→expired interval job + treasurer notify | timeout | P2 | V1 RECOMMENDED | unit | After P0 #1 |
| Surface `concurrentWarning` in `record-payment-form.tsx` (or pre-check + confirm) | M6-R4 | P2 | V1 RECOMMENDED | component test | Backend data already returned |
| Idempotency per payment-intent (or idempotent settle) | M6-R8 | P2 | V1 RECOMMENDED | duplicate-event test | |
| Life-member block at checkout/link/record | AC-M06-007 | P2 | V1 RECOMMENDED | unit | |
| Token consume-on-confirm (not on checkout creation); align expiry with product decision | token UX | P2 | V1 RECOMMENDED | unit | `[NEEDS PRODUCT DECISION]` |
| Transactionalize `confirmPaymentProof` | atomicity | P2 | V1 RECOMMENDED | failure-injection unit | |
| Reverse-allocation rounding via last-fund-absorbs | drift | P2 | V1 RECOMMENDED | property-ish unit | |
| Refund/proof-confirm Hurl scenarios | contract gap | P2 | V1 RECOMMENDED | contract | From cutover spec §7 list |
| Doc sync: MODULE_SPEC.dues.md paths, CLAUDE.md `bulkRecordPayments`, cutover spec §7 "plaintext" note (now encrypted), m06 §20 stale AI instructions | doc drift | P3 | V1 RECOMMENDED | none | Cheap, prevents wrong-directory contributions |
| `applySpecialAssessment` TypeSpec shape resolution | drift | P3 | V1 RECOMMENDED | contract | Pre-existing ticket |
| Rename `dueDate` field in token validate response | API clarity | P3 | V1 RECOMMENDED | unit | |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| GCash direct integration (`dues.gcashDirect`) | V2 DEFERRED | Spec flag default false; PayMongo covers GCash |
| Multi-currency support | V2 DEFERRED | PHP-only is the deliberate current default (cutover spec §9) |
| SMS/letter dunning channels (spec `dunning_channel` enum) | V2 DEFERRED | Schema supports in-app/email/push booleans; sms/letter have no delivery infra |
| Enhanced dunning V2 templates (`dues.dunningV2`) | V2 DEFERRED | Get basic escalation working first (P1) |
| Royalty split (chapter↔national revenue sharing, m06 §2 domain term) | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | No schema/handlers exist; not in any AC |
| Generic multi-gateway adapter framework beyond Stripe(+PayMongo) | DO NOT ADD `[DO NOT OVERBUILD]` | M6-R12 is satisfied by the existing adapter interface once wired; don't build a plugin system |
| Receipt PDF pipeline rework (current HTML receipt) | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Fix numbering first; format upgrade is polish |
| Caching layer for gateway config / reminder schedule (m06 §16) | DO NOT ADD `[DO NOT OVERBUILD]` | No evidence of load problems; premature |
| Observability metrics suite (m06 §17 counters/histograms) | V2 DEFERRED | Structured logs exist; metrics infra is platform-wide concern |
| Expanding the 5 unregistered helper handlers into public endpoints | DO NOT ADD | Superseded by fixing the registered flow |

## 24. Audit Decision

**FAIL**

The module's officer-side surface (manual recording, proof review, invoices, dashboard, reports, special assessments, reminders) is substantially implemented and reasonably tested. But three P0s block reliable V1 use of a financial module: (1) the online one-tap payment flow — the spec's flagship P0 workflow — takes real money via Stripe without ever creating a payment record, receipt, or invoice update, with the webhook settlement seam structurally broken and masked by synthetic-metadata tests; (2) cross-org refunds are possible due to a missing tenant guard on `refundDuesPayment`; (3) receipt numbering will collide across organizations and break manual recording in the platform's core multi-org deployment mode. Seven P1s (missing treasurer gating on gateway/config/funds mutations, member invoice privacy leak, stubbed dunning, unguarded refunds, broken first-payment funnel) compound the trust problem.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Token expiry: 30 days (AC-M06-003) or 72h (implementation)? | `[NEEDS PRODUCT DECISION]` | Determines fix direction for token lifecycle | Product (Elad) |
| Should partial refunds reverse membership expiry proportionally, or only full refunds (current)? | `[NEEDS PRODUCT DECISION]` | BR-08 wording ambiguous; affects refund fix scope | Product |
| When no funds are configured, should payment go to a "default fund" (spec edge case marked [VERIFY]) or skip allocation (current)? | `[NEEDS PRODUCT DECISION]` | Affects settle behavior + reporting | Product |
| Who receives the `association:admin` Better-Auth role, and is it officer-equivalent? | `[NEEDS CONFIRMATION]` | Determines true severity of the 10 ungated mutations | Eng |
| Is PayMongo a V1 requirement (PH market) or can checkout be Stripe-only for pilot? | `[NEEDS PRODUCT DECISION]` | Decides adapter-wiring vs provider-gating | Product |
| Is gateway-API refund execution required for V1, or is ledger-only refund acceptable for pilot (manual refund via Stripe dashboard)? | `[NEEDS PRODUCT DECISION]` | Scopes refund fix; affects billing module | Product |
| First-invoice trigger: event consumer on MembershipApproved, or widen `generateDuesInvoicesForOrg` to `pendingPayment` members? | `[NEEDS PRODUCT DECISION]` | Cross-module design choice (m05 seam) | Eng + Product |
| Is `gatewayConfig.publicKey` actually storing the Stripe connected-account id (`acct_...`)? | `[NEEDS CONFIRMATION]` | Determines whether checkout routes money to the right org account (BR-30) | Eng |
| Should member self-serve "Pay Now" from the dashboard be V1 (WF-038 step 1 alternative), or are emailed links sufficient? | `[NEEDS PRODUCT DECISION]` | Scopes the funnel fix | Product |
| Are the m06 §18 feature flags (dues.onlinePayment etc.) still intended? No flag infra usage found in module | `[NEEDS CONFIRMATION]` | Spec/impl drift | Product |

## 26. Notes for Gap Plan Organizer

- **Fix batch 1 (P0, do first, all V1 REQUIRED):** (1) webhook→ledger seam — write the failing integration test with REAL checkout metadata before touching code; salvage `initiateOnlinePayment.ts` logic; (2) cross-org refund guard — tiny fix, big risk, test-first in `dues-mutation-auth.test.ts`; (3) receipt numbering — needs a schema migration (counter table or per-org unique), so flag `[SHARED DEPENDENCY]` and sequence carefully with seeds.
- **Fix batch 2 (P1 RBAC/validation, mostly mechanical):** x-require-position extensions on the 10 ungated ops (one TypeSpec pass + regen), `validateFundSplits` wiring, `listDuesInvoices` self-scoping, refund over-refund cap + `refund-validation.ts` wiring. All have existing patterns/utils to copy — low risk, test-first.
- **Fix batch 3 (P1 workflow, needs product decisions):** dunning implementation (logic already exists in `dunning-escalation.ts` — wiring job), first-invoice-on-approval + reminder payment links (blocked on product decisions Q7/Q9; cross-module with m05/m07), gateway refund execution (blocked on Q6, touches billing).
- **Tests to write first:** every batch-1 and batch-2 item has a named missing test in §20; the webhook integration test is the single most important artifact — current green tests are fake-green for the online flow.
- **Do not implement yet:** anything in §23; PayMongo wiring until Q5 answered; token-expiry change until Q1 answered.
- **Implemented-but-not-in-PRD to leave alone:** 5 unregistered helper handlers (delete or salvage during batch 1, don't register as-is); billing.tsp duplicate webhook route (separate billing ticket).
- **Watch the shared seams:** `membership-lifecycle.ts` (membership module owns it), `core/domain-event-consumers.ts` (expiry double-update), seeds importing dues schemas via shims.
- **Doc sync rider (cheap, P3):** MODULE_SPEC.dues.md paths, CLAUDE.md `bulkRecordPayments`, cutover spec §7 plaintext-note (encryption now real), m06 §20 stale "handlers/dues 15 hand-wired" instruction.

---

Next recommended step:
Module/group: Dues & Payments
Module slug: dues-payments
Primary PRD/spec: docs/product/modules/m06-dues-payments/MODULE_SPEC.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dues-payments-gap-plan.md
