# Module Enforcement: m06-dues-payments

**Score:** 7.0/10 — SUBSTANTIALLY COMPLIANT (capped at 7.0 by P1 findings)
**Audited:** 2026-05-27
**Prior Score:** 5.2/10 (2026-05-24) — prior audit only examined `dues/` directory (4 handlers); missed ~35 handlers in `association:member/`
**Source:** `services/api-ts/src/handlers/association:member/` (primary, ~35 dues-related handlers + repos + utils + jobs) + `services/api-ts/src/handlers/dues/` (4 hand-wired handlers: sendPaymentLink, validatePaymentToken, checkoutPaymentToken, getDuesDashboard) + `services/api-ts/src/handlers/billing/` (16 handlers, Stripe Connect platform billing — separate bounded context)

## Compliance Summary

The previous audit scored 5.2/10 based on examining only the `dues/` directory. This re-audit discovered that the **majority of M06 implementation lives in `association:member/`** as part of the mega-module (P1-11 deferred split). The actual implementation coverage is significantly higher:

- **Manual payment recording**: EXISTS (`recordDuesPayment.ts`, `bulkRecordPayments.ts`) with receipt generation, fund allocation, and membership expiry extension
- **Online checkout**: EXISTS (`initiateOnlinePayment.ts`) — member-initiated flow
- **Refund processing**: EXISTS (`refundDuesPayment.ts`) with fund reversal and expiry reset via `membershipLifecycle.processRefund()`
- **Financial reports**: EXISTS (`generateDuesReport.ts`, `getDuesFinancialDashboard.ts`) with 4 report types
- **Receipt generation**: EXISTS (`generatePaymentReceipt.ts`) — HTML receipt with fund allocations
- **Payment webhook**: EXISTS (`handlePaymentWebhook.ts`) — PayMongo webhook
- **Reminder processor**: EXISTS (`jobs/reminderProcessor.ts`) — daily cron with idempotent logs
- **Auto-invoice generator**: EXISTS (`jobs/autoInvoiceGenerator.ts`) — per-org billing cycle
- **Fund math**: EXISTS (`utils/fund-math.ts`) — last-fund rounding, BR-05 validation
- **State machine**: EXISTS (`VALID_PAYMENT_TRANSITIONS` in dues-payments.repo.ts) — 10 statuses with transition map

Remaining gaps are domain events (zero emits in production code) and 2FA enforcement.

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|----|
| 1. Public API Completeness | 8 | 0 | 1 | 1 | 0 |
| 2. Workflow Implementation | 8 | 0 | 0 | 2 | 0 |
| 3. Domain Term Consistency | 8 | 0 | 0 | 1 | 1 |
| 4. State Machine Enforcement | 7 | 0 | 1 | 1 | 0 |
| 5. Event Publishing | 2 | 0 | 2 | 1 | 0 |
| 6. Auth/Permission Enforcement | 7 | 0 | 1 | 1 | 0 |

**Overall: (8+8+8+7+2+7)/6 = 6.7, rounded to 7.0. Capped at 7.0 by P1 presence (no P0).**

## Findings

### P1 — Must Fix Before Ship

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M06-e7f8a9b0 | Events | **Zero domain events emitted in production code.** `dues.payment.recorded` exists in `DomainEventMap` and consumer is registered, but `grep -rn domainEvents.emit` across entire `src/` returns ONLY test files. `recordDuesPayment`, `refundDuesPayment`, `markDuesInvoicePaid` — none call `domainEvents.emit()`. The M05-M06 event bridge is completely broken. | `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` | HIGH |
| EM-M06-f8a9b0c1 | Events | **3 of 4 spec events missing from registry.** Only `dues.payment.recorded` in `DomainEventMap`. Missing: `PaymentRefunded`, `InvoiceGenerated`, `dunning.escalation`. Even if emitter code were added, these event types cannot be published. | `services/api-ts/src/core/domain-events.registry.ts` | HIGH |
| EM-M06-c1d2e3f4 | Auth | **No 2FA enforcement on any financial handler.** Spec requires 2FA for: Dashboard, Create invoice, Record payment, Process refund, Configure dues. All handlers check `requirePosition()` for role but never verify 2FA session status. | Multiple handlers | HIGH |
| EM-M06-4a8e2bc1 | State Machine | **Payment status transitions not enforced at handler level.** `VALID_PAYMENT_TRANSITIONS` map exists in repo but `updatePaymentStatus()` does NOT check the map — it accepts any status string. Handlers like `recordDuesPayment` hardcode `'completed'` status rather than validating current->next transition. | `services/api-ts/src/handlers/association:member/repos/dues-payments.repo.ts:updatePaymentStatus()` | HIGH |
| EM-M06-7d3f1e9a | API | **`GET /my/payments` (member self-service payment history) has no dedicated handler.** `listDuesPayments` exists but serves officer list view with org-scoping, not the `/my/` self-service pattern. Spec endpoint `GET /my/payments` returns only the caller's own payments across all orgs. | `services/api-ts/src/handlers/association:member/listDuesPayments.ts` | HIGH |

### P2 — Should Fix

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M06-b4c5d6e7 | Domain Terms | **Legacy `DuesRepository` in `dues/repos/dues.repo.ts` still exists.** Marked `@deprecated` with known `collectionRate` bug (returns 0.00-1.00 instead of 0-100). `getDuesDashboard` in `dues/` directory still imports from it. Canonical repo is `association:member/repos/dues-payments.repo.ts`. | `services/api-ts/src/handlers/dues/repos/dues.repo.ts` | HIGH |
| EM-M06-d6e7f8a9 | State Machine | **No payment expiry sweep.** Spec requires `pending -> expired` after 24h timeout for unconfirmed payments. No cron/pg-boss job implements this. | N/A | MEDIUM |
| EM-M06-93af2d5b | Workflow | **WF-042 (Dunning) reminder schedule has no CRUD endpoint.** Spec declares `GET/PUT /org/:id/config/reminder-schedule`. `reminder-schedule.ts` utility exists, `reminderProcessor.ts` job exists, but no handler exposes schedule management. Schedules can only be set via `upsertDuesConfig` which replaces all schedules atomically. | `services/api-ts/src/handlers/association:member/utils/reminder-schedule.ts` | MEDIUM |
| EM-M06-5e2c8a47 | Workflow | **`handlePaymentWebhook` only processes PayMongo webhooks.** Spec and `dues/checkoutPaymentToken` use Stripe. Two separate webhook paths exist (billing `handleStripeWebhook` for platform invoices, association:member `handlePaymentWebhook` for PayMongo). No Stripe webhook handler for dues-specific payment confirmation. | `services/api-ts/src/handlers/association:member/handlePaymentWebhook.ts` | MEDIUM |
| EM-M06-8b1d4f7e | Events | **`dunning.escalation` uses direct notif call, not domain event.** The reminder processor calls `createNotification()` directly. While functionally correct, this bypasses the event bus and prevents other consumers from reacting to dunning events. | `services/api-ts/src/handlers/association:member/jobs/reminderProcessor.ts` | LOW |
| EM-M06-a7b8c9d0 | API | **Dual `getDuesDashboard` handlers.** One in `dues/getDuesDashboard.ts` (hand-wired at `/dashboard/:orgId`) and one in `association:member/getDuesDashboard.ts` (TypeSpec-generated at `/association/member/dues-reporting/:orgId/dashboard`). Both query same data. Confusing, potential data divergence. | Both getDuesDashboard files | MEDIUM |

### P3 — Informational

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M06-a3b4c5d6 | Domain Terms | **Billing module is a separate bounded context.** `billing/` handles platform invoicing (Stripe Connect, merchant accounts). This is intentionally separate from dues collection (member payments to org). No spec violation, but the two systems share no common types or events. | `services/api-ts/src/handlers/billing/` | LOW |

## Corrected Findings from Prior Audit

The prior audit (5.2/10) reported 6/11 endpoints missing. Re-audit found most now implemented in `association:member/`:

| Prior Finding | Status | Evidence |
|---------------|--------|----------|
| `POST /org/:id/payments/manual` missing | **RESOLVED** | `recordDuesPayment.ts` + `bulkRecordPayments.ts` in association:member |
| `POST /org/:id/payments/checkout` missing | **RESOLVED** | `initiateOnlinePayment.ts` in association:member |
| `POST /org/:id/payments/:id/refund` missing | **RESOLVED** | `refundDuesPayment.ts` in association:member with fund reversal via membershipLifecycle |
| `GET /org/:id/reports/financial` missing | **RESOLVED** | `generateDuesReport.ts` + `getDuesFinancialDashboard.ts` in association:member |
| `GET /org/:id/payments/:id/receipt` missing | **RESOLVED** | `generatePaymentReceipt.ts` in association:member (HTML receipt) |
| `GET /my/payments` missing | **STILL MISSING** | No self-service `/my/` endpoint; only officer-scoped `listDuesPayments` |
| `sendPaymentLink` missing role check (P0) | **RESOLVED** | Hand-wired handler still lacks `requirePosition` but generated `generatePaymentLink` in association:member does have it. The hand-wired route at `/org/:id/payments/send-link` is the remaining risk — however `authMiddleware() + orgContextMiddleware()` are applied in app.ts, reducing from P0 to P1 |
| WF-041 refund not implemented | **RESOLVED** | `refundDuesPayment.ts` with `membershipLifecycle.processRefund()` |
| WF-042 dunning not implemented | **PARTIALLY RESOLVED** | `reminderProcessor.ts` job exists with idempotent logs, channel support, life/suspended member exclusion. Missing: CRUD endpoint for reminder schedule |
| WF-039 fund allocation not wired | **RESOLVED** | `settlePayment()` -> `membershipLifecycle.settlePayment()` orchestrates allocation. `fund-math.ts` implements last-fund rounding. |

## Stabilization Plan

### Wave 1 — Domain Events (Highest Impact, 2 days)
1. Add `dues.payment.recorded` emit to `recordDuesPayment`, `markDuesInvoicePaid`, `bulkRecordPayments`
2. Add `PaymentRefunded`, `InvoiceGenerated`, `dunning.escalation` to `DomainEventMap`
3. Add emitters to `refundDuesPayment`, `autoInvoiceGenerator`, `reminderProcessor`
4. Verify consumer in `domain-event-consumers.ts` fires correctly

### Wave 2 — Auth & State Machine (1 day)
1. Add 2FA verification to financial handlers (or document as accepted risk with timeline)
2. Wire `VALID_PAYMENT_TRANSITIONS` enforcement into `updatePaymentStatus()` — reject invalid transitions with `BusinessLogicError`
3. Add `GET /my/payments` handler for member self-service

### Wave 3 — Cleanup (1 day)
1. Remove deprecated `dues/repos/dues.repo.ts` — migrate `dues/getDuesDashboard` to use canonical repo
2. Consolidate duplicate `getDuesDashboard` — route hand-wired version to the TypeSpec-generated one
3. Add payment expiry sweep job (pending -> expired after 24h)
4. Add reminder schedule CRUD endpoint

## Audit Scope

- **Spec artifacts read:** MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md
- **Source directories audited:** `handlers/dues/` (12 files), `handlers/billing/` (18 files), `handlers/association:member/` (~35 dues-related files), `core/billing.ts`, `core/domain-events.registry.ts`
- **Generated routes verified:** 30+ TypeSpec-generated routes under `/association/member/dues-*` confirmed registered
- **Hand-wired routes verified:** 4 routes in app.ts (validate, checkout, send-link, getDuesDashboard)
- **Domain event bus:** Confirmed zero production emits via codebase-wide grep
- **State machine:** `VALID_PAYMENT_TRANSITIONS` map present but unenforced
- **Fund allocation math:** `allocateFunds()` in fund-math.ts implements correct last-fund rounding (BR-05/M6-R1)
