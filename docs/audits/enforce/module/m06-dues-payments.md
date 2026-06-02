# Module Enforcement: m06-dues-payments

**Score:** 6.5/10 -- PARTIALLY COMPLIANT (capped by P0 domain events gap + 5 P1 findings)
**Audited:** 2026-05-28
**Prior Score:** 7.0/10 (2026-05-27) -- prior audit may have been lenient on state machine and compliance gaps
**Spec:** `docs/product/modules/m06-dues-payments/MODULE_SPEC.md` v2.0 (2026-05-21)
**Source:** `services/api-ts/src/handlers/dues/` (8 impl files, 6 jobs, schema+repo) + `services/api-ts/src/handlers/billing/` (16 handlers, Stripe Connect) + `services/api-ts/src/handlers/association:member/` (~35 dues-related handlers in mega-module)

## Compliance Summary

M06 spans 3 handler directories. Core dues CRUD (configs, invoices, payments, reporting, gateway) lives in `association:member/` (mega-module). Hand-wired token payment flow (`checkoutPaymentToken`, `validatePaymentToken`, `sendPaymentLink`, `getDuesDashboard`, `downloadReceipt`, `stripeWebhook`) lives in `dues/`. Platform billing (Stripe Connect invoices, merchant accounts) lives in `billing/` as a separate bounded context.

**Critical gap:** Zero domain events emitted in production code -- the M05-M06 event bridge is broken. PaymentRecorded (required for membership expiry updates) never fires.

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|----|
| 1. Public API Completeness | 7 | 0 | 1 | 2 | 0 |
| 2. Workflow Implementation | 7 | 0 | 0 | 2 | 1 |
| 3. State Machine Enforcement | 6 | 0 | 2 | 0 | 0 |
| 4. Domain Events | 0 | 1 | 0 | 0 | 0 |
| 5. Auth/Permission Enforcement | 5 | 0 | 2 | 0 | 0 |
| 6. Data Model Fidelity | 8 | 0 | 0 | 1 | 1 |
| 7. Business Rules | 7 | 0 | 1 | 2 | 0 |

**Overall: weighted 6.5/10. Capped by P0 presence.**

## Findings

### P0 -- Blocks Ship

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M06-07a4d6e9 | Events | **Zero domain events emitted in production code.** All 4 spec events (`PaymentRecorded`, `PaymentRefunded`, `InvoiceGenerated`, `dunning.escalation`) have zero `emitEvent`/`domainEvents.emit()` calls outside test files. `PaymentRecorded` is the primary trigger for M05 membership expiry updates (BR-07). The M05-M06 event bridge is completely broken. Additionally, only `dues.payment.recorded` exists in `DomainEventMap` -- the other 3 event types are not registered. | `handlers/association:member/recordDuesPayment.ts`, `core/domain-events.registry.ts` | HIGH |

### P1 -- Must Fix Before Ship

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M06-02b7d1e4 | API | **`GET /my/payments` has no handler.** Spec Section 10 declares personal payment history endpoint. `listDuesPayments` serves officer list view with org-scoping, not the `/my/` self-service pattern. Members cannot view their own payment history across orgs. | N/A | HIGH |
| EM-M06-08b5e7f0 | Auth | **No 2FA enforcement on any financial handler.** Spec Section 6 requires 2FA for Dashboard, Create invoice, Record payment, Process refund, Configure dues. All handlers check `requirePosition()` for role but never verify 2FA session status. `officerAuthMiddleware` referenced in spec AI Instructions is not implemented. | Multiple handlers | HIGH |
| EM-M06-09c6f8a1 | Auth | **SEC-01 RED tests document missing org-scoped RBAC on 4 invoice handlers.** `dues-mutation-auth.test.ts` explicitly marks `createDuesInvoice`, `updateDuesInvoice`, `deleteDuesInvoice`, `generateDuesInvoicesForOrg` as lacking position-based auth. Tests expected to FAIL against current code. | `handlers/association:member/dues-mutation-auth.test.ts` | HIGH |
| EM-M06-06f3c5d8 | State Machine | **`DuesPaymentStatusHistory` entity from spec Section 7 not implemented.** No schema table, no implementation. Payment status transitions happen but are not logged. Financial audit trail for payment lifecycle is absent. | N/A | HIGH |
| EM-M06-11e8b0c3 | Business Rules | **BR-32 (7-year financial retention) conflicts with `deleteDuesInvoice` endpoint.** Hard-delete available via OpenAPI. Financial records must be soft-delete only per BIR compliance requirement. | `handlers/association:member/deleteDuesInvoice.ts` | HIGH |

### P2 -- Should Fix

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M06-01a3f8c2 | API | **Spec Section 10 is outdated.** Declares 11 endpoints; actual OpenAPI has 32+ dues-related endpoints. Proof-of-payment workflow (4 endpoints: listPendingProofs, submitPaymentProof, confirmPaymentProof, rejectPaymentProof), payment link generation, expanded CRUD, batch invoice generation -- all undocumented in spec. | `MODULE_SPEC.md` Section 10 | HIGH |
| EM-M06-03c9e2f6 | API | **`downloadReceipt` handler not in OpenAPI.** Hand-wired route exists but has no TypeSpec definition. | `handlers/dues/downloadReceipt.ts` | HIGH |
| EM-M06-04d1a3b5 | Workflow | **WF-042 (Dunning) has no API for managing templates or viewing history.** Schema (`dunning_template`, `dunning_event`) and processor job exist, but officers cannot create/edit/list dunning templates via API. Schedules only manageable atomically via `upsertDuesConfig`. | `handlers/association:member/repos/dunning.schema.ts` | MEDIUM |
| EM-M06-12f9c1d4 | Business Rules | **M6-R4 (concurrent payment 5-min duplicate warning) not implemented.** No detection logic found in `recordDuesPayment` handler. Spec says: "IF two treasurers record for same member within 5 minutes THEN warn about potential duplicate." | `handlers/association:member/recordDuesPayment.ts` | MEDIUM |
| EM-M06-13a0d2e5 | Business Rules | **M6-R6 receipt sequence not atomic.** `receiptNumber` field has unique constraint but no database sequence or counter table. Under concurrent payment recording at convention desks, race conditions possible. | `handlers/dues/repos/dues-payments.schema.ts` | MEDIUM |
| EM-M06-a7b8c9d0 | Data Model | **Dual `getDuesDashboard` handlers.** One in `dues/getDuesDashboard.ts` (hand-wired at `/dues/dashboard/:orgId`, uses deprecated `DuesRepository`) and one in `association:member/` (TypeSpec-generated at `/association/member/dues-reporting/:orgId/dashboard`). Both query same data. Potential data divergence. | Both getDuesDashboard files | MEDIUM |

### P3 -- Informational

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M06-05e2b4c7 | Workflow | **Receipt generation produces HTML, not PDF.** Spec implies PDF via `GET /org/:id/payments/:id/receipt`. `downloadReceipt.ts` returns HTML content. | `handlers/dues/downloadReceipt.ts` | LOW |
| EM-M06-14b1e3f6 | Data Model | **Handler logic fragmented across 3 directories.** `dues/`, `billing/`, `association:member/`. Spec says "new handlers should go in `dues/`" but most CRUD is in `association:member/`. Architectural debt from mega-module (P1-11 deferred split). | Multiple directories | LOW |

## DECLARED_API vs Actual Endpoints

### Spec Section 10 (11 endpoints):

| Spec Endpoint | OpenAPI Match | Status |
|---|---|---|
| `POST /org/:id/payments/manual` | `recordDuesPayment` (POST /association/member/dues-payments) | PRESENT (path differs) |
| `POST /org/:id/payments/checkout` | `checkoutPaymentToken` (POST /pay/{token}/checkout) | PRESENT (token-scoped, not org-scoped) |
| `POST /webhooks/:provider` | `handleStripeWebhook` (POST /billing/webhooks/stripe) | PRESENT (Stripe only, spec says generic `:provider`) |
| `POST /org/:id/payments/:id/refund` | `refundDuesPayment` | PRESENT |
| `GET /org/:id/reports/financial` | `generateDuesReport` + `getDuesFinancialDashboard` | PRESENT (split into 2) |
| `GET /my/payments` | **MISSING** | No handler, no route |
| `PUT /org/:id/config/dues` | Full CRUD (create/list/get/update/delete) | PRESENT (expanded) |
| `PUT /org/:id/config/funds` | `upsertDuesFunds` | PRESENT |
| `POST /org/:id/config/gateway` | `upsertDuesGatewayConfig` + `testDuesGatewayConnection` + `disconnectDuesGateway` | PRESENT (expanded) |
| `GET /org/:id/payments/:id/receipt` | `downloadReceipt` (hand-wired, NOT in OpenAPI) | PARTIAL |
| `GET /pay/:token` | `validatePaymentToken` | PRESENT |

### Bonus endpoints in OpenAPI (not in spec):

- `getDuesDashboard`, `sendPaymentLink` -- officer tools
- `listPendingProofs`, `submitPaymentProof`, `confirmPaymentProof`, `rejectPaymentProof` -- proof-of-payment workflow
- `generateDuesInvoicesForOrg`, `markDuesInvoicePaid` -- batch operations
- `disconnectDuesGateway`, `testDuesGatewayConnection` -- gateway management
- Full invoice CRUD (6 endpoints), full config CRUD (5 endpoints)

## State Machine Coverage

### Payment Status (10 values in enum)

```
pending -> completed | failed | expired | submitted
submitted -> underReview
underReview -> confirmed | rejected
completed -> refunded | partiallyRefunded
confirmed -> refunded | partiallyRefunded
```

`DUES_PAYMENT_VALID_TRANSITIONS` exists in `@/utils/status-transitions` and `assertValidTransition()` is called in `dues-payments.repo.ts:179`. Prior audit noted `updatePaymentStatus()` may not enforce transitions -- verify enforcement path is complete.

### Webhook Retry Status (4 values)

`processing -> completed | pending_retry`, `pending_retry -> processing | dead_letter`
Implemented in `webhookRetryProcessor.ts` with exponential backoff (1m, 5m, 15m, 1h).

## Business Rules Coverage

| Rule | Status | Evidence |
|---|---|---|
| BR-04 (org config with category overrides) | IMPLEMENTED | `duesOrgConfigs` + `duesCategoryOverrides` tables |
| BR-05 (fund allocation sums to 100%) | IMPLEMENTED | `allocateFunds` + `validateFundSplits` in `fund-math.ts`, tested |
| BR-06 (manual payment records officer) | IMPLEMENTED | `recordedBy` field on `dues_payment` |
| BR-07 (payment extends expiry) | IMPLEMENTED | `settlePayment` -> `membershipLifecycle.settlePayment()` |
| BR-08 (refund reverses expiry) | IMPLEMENTED | `refundDuesPayment` with allocation reversal |
| BR-30 (gateway isolation) | PARTIAL | Separate tables, but no runtime cross-org validation |
| BR-32 (7-year retention, no hard delete) | **VIOLATED** | `deleteDuesInvoice` endpoint allows hard delete |
| M6-R1 (last fund absorbs rounding) | IMPLEMENTED | `allocateFunds` last-fund logic |
| M6-R2 (state machine enforcement) | IMPLEMENTED | `assertValidTransition` in repo |
| M6-R4 (5-min duplicate warning) | **NOT IMPLEMENTED** | No detection code |
| M6-R5 (reminder defaults) | PARTIAL | Tables exist, processor runs, defaults not seeded |
| M6-R6 (receipt format ORG_CODE-YEAR-SEQ) | PARTIAL | Unique constraint, no atomic sequence |
| M6-R8 (webhook idempotency) | IMPLEMENTED | `webhookRetryProcessor` with dedup |
| M6-R12 (gateway adapter pattern) | IMPLEMENTED | `GatewayAdapter` interface + `PayMongoAdapter` |

## Domain Events

| Event | Spec Status | Implementation | Gap |
|---|---|---|---|
| `PaymentRecorded` | Published | In `DomainEventMap` as `dues.payment.recorded` | Zero production emits |
| `PaymentRefunded` | Published | NOT in `DomainEventMap` | Not registered, not emitted |
| `InvoiceGenerated` | Published | NOT in `DomainEventMap` | Not registered, not emitted |
| `dunning.escalation` | Published | NOT in `DomainEventMap` | Not registered, not emitted |
| `MembershipCreated` (consumed) | From M05 | Not wired | No consumer |
| `MembershipTierChanged` (consumed) | From M05 | Not wired | No consumer |

## Stabilization Plan

### Wave 1 -- Domain Events (P0, 2 days)
1. Register `PaymentRefunded`, `InvoiceGenerated`, `dunning.escalation` in `DomainEventMap`
2. Add `domainEvents.emit('dues.payment.recorded', ...)` to `recordDuesPayment`, `markDuesInvoicePaid`, `bulkRecordPayments`
3. Add emitters to `refundDuesPayment`, `autoInvoiceGenerator`, `reminderProcessor`
4. Wire M05 consumer for expiry updates

### Wave 2 -- Auth + State Machine (P1, 2 days)
1. Add `GET /my/payments` handler for member self-service
2. Implement 2FA verification for financial handlers (or document accepted risk with timeline)
3. Fix RBAC on 4 invoice mutation handlers (SEC-01)
4. Add `DuesPaymentStatusHistory` table and log transitions
5. Convert `deleteDuesInvoice` to soft-delete for BR-32 compliance

### Wave 3 -- Business Rules + Cleanup (P2, 1 day)
1. Add 5-min concurrent payment duplicate warning (M6-R4)
2. Implement atomic receipt sequence generator (M6-R6)
3. Add TypeSpec definition for `downloadReceipt`
4. Consolidate duplicate `getDuesDashboard` handlers
5. Add dunning template CRUD endpoints

## Audit Scope

- **Spec artifacts:** MODULE_SPEC.md v2.0, OpenAPI spec (openapi.json)
- **Source directories:** `handlers/dues/` (8 impl files + 6 jobs + repos), `handlers/billing/` (16 handlers + repos), `handlers/association:member/` (~35 dues-related files + repos + utils)
- **TypeSpec sources:** `billing.tsp`, `dues-custom.tsp`, `association:member` TypeSpec modules
- **Domain event bus:** Confirmed zero production emits via codebase-wide grep
- **State machine:** `DUES_PAYMENT_VALID_TRANSITIONS` present, `assertValidTransition` called in repo
- **Fund allocation math:** `allocateFunds()` correct (last-fund rounding, BR-05)
- **Gateway adapter:** `GatewayAdapter` interface + PayMongo implementation confirmed
- **Webhook idempotency:** `webhookRetryProcessor` with exponential backoff confirmed


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
