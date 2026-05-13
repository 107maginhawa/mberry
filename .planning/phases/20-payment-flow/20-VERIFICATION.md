---
phase: 20-payment-flow
verified: 2026-05-14T00:00:00Z
status: human_needed
score: 5/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Member navigates to /my/payments and sees their own payment history with receipt numbers"
    expected: "Table renders rows with Receipt #, Amount, Method, Date columns. Receipt numbers visible. Non-officer sees only their own payments."
    why_human: "PaymentHistoryTable renders receipts from live API; cannot verify data flows through without a running server and seeded payments."
  - test: "Officer records a GCash/bank-transfer payment for a member — payment saves and receipt number is returned"
    expected: "POST /association/member/dues-payments returns 201 with receiptNumber field (e.g. ORG-2026-000001)"
    why_human: "End-to-end requires a running API + DB with an org, person, officer term, and invoice."
  - test: "Two concurrent officer requests to mark same invoice paid — second returns 409"
    expected: "First POST /association/member/dues-invoices/{id}/mark-paid succeeds (200). Concurrent second call with same invoice version returns ConflictError 409."
    why_human: "Race condition; requires concurrent HTTP requests against a live API with real Postgres row versioning."
---

# Phase 20: Payment Flow Verification Report

**Phase Goal:** Officers can record offline dues payments (GCash, bank transfer), generate member-viewable receipts, and the system prevents double-payment via optimistic locking
**Verified:** 2026-05-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | markPaid() uses WHERE version=N and throws ConflictError(409) when 0 rows affected | VERIFIED | `dues.repo.ts` lines 149-153: `and(eq(duesInvoices.id, invoiceId), eq(duesInvoices.version, expectedVersion))` + `throw new ConflictError(...)` |
| 2 | recordDuesPayment with invoiceId marks the linked invoice as paid inside the same transaction | VERIFIED | `recordDuesPayment.ts` lines 86-89: `if (body.invoiceId && invoiceForLocking)` + `txInvoiceRepo.markPaid(...)` inside `db.transaction()` |
| 3 | Second concurrent payment on same invoice returns 409 ConflictError | VERIFIED (unit) | `markDuesInvoicePaid.test.ts` PAY-03 block tests ConflictError throw; `dues.repo.ts` markPaid throws ConflictError on 0 rows. Human test needed for live concurrency. |
| 4 | Non-officer caller can only see their own payments (personId forced to session.user.id) | VERIFIED | `listDuesPayments.ts` lines 27-31: `effectivePersonId = isOfficer ? query.personId : session.user.id` + 4 PAY-02 tests confirm enforcement |
| 5 | Officer caller can query any personId within their org (existing behavior preserved) | VERIFIED | `listDuesPayments.ts` officer path passes `query.personId`; test `[PAY-02] officer can query any personId within org` confirms |
| 6 | Member accessing /my/payments sees only their own payment records with receipt numbers | UNCERTAIN | Backend enforcement verified. Frontend `PaymentHistoryTable` renders `p.receiptNumber` column. Live data flow requires human verification. |

**Score:** 5/6 truths verified (truth 6 requires human testing)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/api-ts/src/handlers/association:member/repos/dues.repo.ts` | markPaidWithOptimisticLock | VERIFIED | Contains `expectedVersion` param, `eq(duesInvoices.version, expectedVersion)` WHERE clause, ConflictError throw, version increment |
| `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` | Invoice linking inside transaction | VERIFIED | `invoiceForLocking` pattern, `txInvoiceRepo.markPaid` inside `db.transaction()` |
| `services/api-ts/src/handlers/association:member/markDuesInvoicePaid.test.ts` | Optimistic locking test | VERIFIED | PAY-03 describe block with 3 tests covering ConflictError, version passing, success case |
| `services/api-ts/src/handlers/association:member/listDuesPayments.ts` | Self-service personId enforcement | VERIFIED | `effectivePersonId`, `requireOfficerTerm`, `session.user.id` all present |
| `services/api-ts/src/handlers/association:member/listDuesPayments.test.ts` | PAY-02 enforcement tests | VERIFIED | 4 tests in `[PAY-02]` describe block |
| `apps/memberry/src/routes/_authenticated/my/payments.tsx` | Member payment view route | VERIFIED | Route renders `PaymentHistoryTable` with `scope="member"` |
| `apps/memberry/src/features/dues/components/payment-history-table.tsx` | Receipt display table | VERIFIED | Renders `p.receiptNumber` column; uses `listDuesPaymentsOptions` SDK hook |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `recordDuesPayment.ts` | `dues.repo.ts` | `txInvoiceRepo.markPaid` inside `db.transaction` | WIRED | Line 88: `await txInvoiceRepo.markPaid(body.invoiceId, invoiceForLocking.version, pay.id, new Date())` |
| `markDuesInvoicePaid.ts` | `dues.repo.ts` | `markPaid(invoiceId, invoice.version, ...)` | WIRED | Line 51: `await txInvoiceRepo.markPaid(invoiceId, invoice.version, body.paymentId, new Date())` |
| `listDuesPayments.ts` | `officer-check.ts` | `requireOfficerTerm` call | WIRED | Line 27: `const officerDenied = await requireOfficerTerm(ctx as any)` |
| `payment-history-table.tsx` | `listDuesPayments` API | `listDuesPaymentsOptions` SDK hook | WIRED | Line 45-55: `useQuery({ ...listDuesPaymentsOptions(...) })` |
| `my/payments.tsx` | `payment-history-table.tsx` | `<PaymentHistoryTable scope="member" orgId={orgId} />` | WIRED | Line 24 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `payment-history-table.tsx` | `payments` (from `data?.data`) | `listDuesPaymentsOptions` → GET /association/member/dues-payments | API returns DB rows via `DuesRepository.listPayments` | FLOWING (verified code path; live data needs human check) |
| `recordDuesPayment.ts` | `receiptNumber` | `formatReceiptNumber('ORG', year, sequence)` via `repo.getNextReceiptSequence` | DB sequence incremented on each call | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running API server and seeded database. Tests are runnable offline; API spot-checks are not.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| PAY-01 | 20-01 | Officer can record offline dues payment and mark invoice as paid | SATISFIED | `recordDuesPayment.ts` records payment + marks invoice; `markDuesInvoicePaid.ts` marks invoice via officer-gated route; receipt number generated and returned |
| PAY-02 | 20-02 | Payment recording generates a receipt viewable by member and officer | PARTIAL | Receipt number generated in `recordDuesPayment.ts` and stored. Member can view via `/my/payments` page rendering `receiptNumber` column. PAY-02 plan also enforced personId restriction which secures the viewing path. Live rendering needs human check. |
| PAY-03 | 20-01 | Concurrent payment recording handled safely via optimistic locking | SATISFIED (unit) | `markPaid()` uses `WHERE version=N`, throws `ConflictError(409)` on 0 rows affected. Live concurrency test deferred to human. |

**Note on PAY-02:** REQUIREMENTS.md defines PAY-02 as "Payment recording generates a receipt viewable by member and officer." Plan 20-02 interpreted this as the personId self-service enforcement (the access control layer that makes receipts safely viewable). Both the receipt generation (PAY-01 work) and access control (PAY-02 plan) together satisfy the requirement. Receipt column is rendered in `payment-history-table.tsx`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `payment-history-table.tsx` | 58 | `data?.pagination?.totalCount` — API returns `totalCount` at root, not under `pagination` | Warning | Pagination total count may show 0 instead of real count; affects "Showing X-Y of Z" display but not payment data itself |

**Anti-pattern detail:** `listDuesPayments` handler at line 53 returns `{ data, totalCount: Number(result.total) }` (root-level `totalCount`), but the component reads `data?.pagination?.totalCount`. The `payments` array itself is correctly read from `data?.data`. This is a pre-existing cosmetic bug (total count display wrong) not introduced by phase 20.

### Human Verification Required

#### 1. Member Receipt Viewability

**Test:** Log in as a regular member (non-officer). Navigate to `/my/payments`. Verify the payment history table renders rows with Receipt #, Amount, Method, and Date columns. Confirm only payments belonging to the logged-in user appear.
**Expected:** Table shows member's own payments. Receipt numbers display (e.g., `ORG-2026-000001`). No other members' payments visible.
**Why human:** Requires running API + DB with seeded payment records. Frontend data flow through SDK hook cannot be verified statically.

#### 2. Officer Records Offline Payment (GCash / Bank Transfer)

**Test:** Log in as an officer (Treasurer or President role). Use the officer payment recording UI (or POST directly to `/association/member/dues-payments`) with `paymentMethod: "gcash"` and a valid `invoiceId`. Confirm 201 response with `receiptNumber` field.
**Expected:** Payment saved, receipt number returned (e.g., `ORG-2026-000001`), invoice status changes to `paid`.
**Why human:** Requires a live API with an active officer term, member, and dues invoice in DB.

#### 3. Concurrent Double-Payment Prevention (Live)

**Test:** Create a dues invoice. Send two concurrent POST requests to `/association/member/dues-invoices/{id}/mark-paid` with the same invoice. Observe responses.
**Expected:** First request returns 200. Second request returns 409 `ConflictError` with message "Invoice was already paid or modified concurrently."
**Why human:** Race condition requires truly concurrent HTTP requests against Postgres with real row versioning. Unit tests mock the repo; live test is definitive.

### Gaps Summary

No blocker gaps found. All code artifacts exist, are substantive, and are wired. The three human verification items are behavioral/integration checks that cannot be validated statically. One pre-existing cosmetic bug found in pagination count display (not introduced by phase 20).

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_
