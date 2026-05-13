---
phase: 20-payment-flow
plan: 01
subsystem: dues-payments
tags: [optimistic-locking, payment-flow, concurrency, PAY-01, PAY-03]
dependency_graph:
  requires: []
  provides: [optimistic-locking-markPaid, invoice-linking-recordDuesPayment]
  affects: [markDuesInvoicePaid, recordDuesPayment, confirmPaymentProof, handlePaymentWebhook, recordManualPayment]
tech_stack:
  added: []
  patterns: [optimistic-locking-version-field, cross-org-guard, status-guard-before-transaction]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:member/repos/dues.repo.ts
    - services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts
    - services/api-ts/src/handlers/association:member/markDuesInvoicePaid.test.ts
    - services/api-ts/src/handlers/association:member/recordDuesPayment.ts
    - services/api-ts/src/handlers/association:member/recordDuesPayment.test.ts
    - services/api-ts/src/handlers/association:member/confirmPaymentProof.ts
    - services/api-ts/src/handlers/association:member/handlePaymentWebhook.ts
    - services/api-ts/src/handlers/association:member/recordManualPayment.ts
decisions:
  - "markPaid signature changed to (invoiceId, expectedVersion, paymentId, paidAt) — version is always read from DB, never from client"
  - "Invoice pre-validation (status, org ownership) runs outside transaction; only version capture is needed inside"
  - "ConflictError(409) on optimistic lock failure — caller must retry after re-fetching invoice"
metrics:
  duration: 35m
  completed: "2026-05-14"
  tasks_completed: 2
  files_modified: 8
---

# Phase 20 Plan 01: Optimistic Locking + Invoice Linking Summary

**One-liner:** `markPaid()` gains `WHERE version=N` optimistic lock throwing ConflictError(409), and `recordDuesPayment` atomically marks the linked invoice paid inside the same transaction.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add optimistic locking to DuesInvoiceRepository.markPaid | c1bb2fc | dues.repo.ts, markDuesInvoicePaid.ts, markDuesInvoicePaid.test.ts |
| 1 (fix) | Update all markPaid callers to new signature | 161f05e | confirmPaymentProof.ts, handlePaymentWebhook.ts, recordManualPayment.ts |
| 2 | Wire invoice marking inside recordDuesPayment | 6129c2d | recordDuesPayment.ts, recordDuesPayment.test.ts |

## What Was Built

### Task 1: Optimistic Locking on markPaid [PAY-03]

`DuesInvoiceRepository.markPaid()` now takes `expectedVersion: number` as its second parameter. The Drizzle update uses `AND(id=invoiceId, version=expectedVersion)` in the WHERE clause and sets `version=expectedVersion+1` in the SET. If 0 rows are returned, a `ConflictError('Invoice was already paid or modified concurrently')` is thrown with HTTP 409.

`markDuesInvoicePaid.ts` passes `invoice.version` (read before the transaction) to satisfy the new signature.

### Task 2: Invoice Linking in recordDuesPayment [PAY-01]

When `body.invoiceId` is provided to `recordDuesPayment`:

1. **Pre-transaction validation** (read-only, safe):
   - Fetches invoice to get current version
   - Guards: invoice not found → 404, wrong org → 403, non-payable status → 422 BusinessLogicError
   - Captures `{ version }` for the lock

2. **Inside transaction** (after `createPayment`):
   - Creates a `DuesInvoiceRepository` scoped to the transaction connection
   - Calls `txInvoiceRepo.markPaid(invoiceId, capturedVersion, pay.id, new Date())`
   - Atomic with createPayment + settlePayment

When `body.invoiceId` is absent, no invoice code runs — existing behavior unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated three additional markPaid callers to new signature**
- **Found during:** Task 1 commit (pre-commit typecheck)
- **Issue:** `confirmPaymentProof.ts`, `handlePaymentWebhook.ts`, and `recordManualPayment.ts` all called `markPaid(invoiceId, paymentId, paidAt)` with the old 3-arg signature, causing TS2345 type errors
- **Fix:**
  - `confirmPaymentProof.ts`: fetches invoice before calling markPaid to get `.version`
  - `handlePaymentWebhook.ts`: invoice already fetched; added `invoice.version` as second arg
  - `recordManualPayment.ts`: invoice already fetched; added `invoice.version` as second arg
- **Files modified:** confirmPaymentProof.ts, handlePaymentWebhook.ts, recordManualPayment.ts
- **Commit:** 161f05e

## Threat Model Coverage

All four T-20-xx mitigations from the plan's threat register are implemented:

| Threat | Status |
|--------|--------|
| T-20-01: Optimistic lock on markPaid (WHERE version=N) | Implemented |
| T-20-02: Backend reads version from DB, not client | Implemented — client cannot supply invoiceVersion |
| T-20-03: Cross-org guard on recordDuesPayment | Implemented — invoice.organizationId vs orgId check |
| T-20-04: Status guard (only generated/sent/overdue payable) | Implemented — BusinessLogicError INVOICE_NOT_PAYABLE |

## Test Coverage

- `markDuesInvoicePaid.test.ts`: 15 tests (3 new PAY-03 tests)
- `recordDuesPayment.test.ts`: 13 tests (3 new PAY-01 tests)
- All 28 tests pass

## Known Stubs

None — all functionality is fully wired.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. All security surface was pre-existing.

## Self-Check: PASSED

- c1bb2fc exists: confirmed
- 161f05e exists: confirmed
- 6129c2d exists: confirmed
- dues.repo.ts contains `expectedVersion`: confirmed (4 occurrences)
- dues.repo.ts contains `ConflictError`: confirmed (3 occurrences)
- markDuesInvoicePaid.ts contains `invoice.version`: confirmed
- recordDuesPayment.ts contains `markPaid`: confirmed
- recordDuesPayment.ts contains `invoiceForLocking`: confirmed (4 occurrences)
- All tests pass: 28/28
