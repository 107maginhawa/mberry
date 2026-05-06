---
phase: 01-billing-schema-completion
verified: 2026-05-06T04:00:00Z
status: human_needed
score: 3/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run `cd services/api-ts && bun run db:generate` and confirm no new migration is produced"
    expected: "No migration generated — schema is in sync"
    why_human: "db:generate requires interactive TTY that automation cannot provide"
  - test: "Confirm refund exclusion from SC #4 is acceptable given D-05 deferral"
    expected: "User acknowledges refund is deferred to a future phase (not in current roadmap)"
    why_human: "Roadmap SC #4 explicitly mentions refund but D-05 defers it — user decision needed on whether this is a gap or acceptable deviation"
---

# Phase 1: Billing Schema Completion Verification Report

**Phase Goal:** Billing module is fully functional with complete schema, access controls, and test coverage
**Verified:** 2026-05-06T04:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Invoice creation includes all fields (paymentCaptureMethod, lineItems, paidBy, voidedBy, etc.) | VERIFIED | listInvoices.ts:113 reads `invoice.paymentCaptureMethod`, :124 `invoice.paidBy`, :126 `invoice.voidedBy`; batch line items fetch at :99; zero TODOs in listInvoices/getInvoice/finalizeInvoice |
| 2 | Billing Drizzle schema matches TypeSpec billing definitions with no drift | VERIFIED | billing.schema.ts contains all columns: paymentCaptureMethod(:82), paidBy(:92), voidedBy(:95), voidThresholdMinutes(:98), authorizedAt(:101), authorizedBy(:102). Manual confirmation only — db:generate not runnable in CI |
| 3 | Non-admin users cannot access billing management endpoints | VERIFIED | `userRoles.includes('admin')` found in 9 billing handler files (all 7 core + refund + capture); getInvoice.ts:59 throws ForbiddenError for non-customer/non-merchant; listInvoices.ts:81 scopes via customerOrMerchant filter |
| 4 | E2E tests verify full invoice lifecycle (create, pay, void, refund) | PARTIAL | lifecycle.test.ts covers create/finalize/pay/void (7 tests). Refund explicitly excluded per D-05 user decision. No later roadmap phase covers refund testing. |

**Score:** 3/4 truths verified (1 partial due to intentional refund exclusion)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `services/api-ts/src/handlers/billing/listInvoices.ts` | Customer-scoped list with full response mapping | VERIFIED | Contains admin check, customerOrMerchant filter, batch line items, all DB field reads |
| `services/api-ts/src/handlers/billing/getInvoice.ts` | Customer-scoped get with line items | VERIFIED | Contains findOneWithLineItems, ForbiddenError for unauthorized access |
| `services/api-ts/src/handlers/billing/voidInvoice.ts` | Void threshold enforcement | VERIFIED | Contains VOID_THRESHOLD_EXCEEDED at line 79 |
| `services/api-ts/src/handlers/billing/lifecycle.test.ts` | Full invoice lifecycle test | VERIFIED | 7 test cases covering create->finalize->pay->void + threshold + state machine |
| `services/api-ts/src/handlers/billing/accessControl.test.ts` | Access control tests | VERIFIED | 7 test cases covering admin/merchant/customer roles |
| `services/api-ts/src/handlers/billing/listInvoices.test.ts` | Response field completeness tests | VERIFIED | 5 tests verifying paymentCaptureMethod, lineItems, paidBy, voidedBy, scoping |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| listInvoices.ts | billing.repo.ts | InvoiceRepository queries | WIRED | Line 86: `new InvoiceRepository(database, logger)`, Line 89: `findManyWithPagination`, Line 99: `findLineItemsByInvoiceIds` |
| getInvoice.ts | billing.repo.ts | findOneWithLineItems | WIRED | grep confirms import and usage |
| lifecycle.test.ts | handler files | handler imports | WIRED | Tests use makeCtx/stubRepo pattern with handler functions |
| accessControl.test.ts | handler files | handler imports | WIRED | Tests import and invoke handlers directly |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 19 billing tests pass | `bun test lifecycle.test.ts accessControl.test.ts listInvoices.test.ts` | 19 pass, 0 fail, 39 expect() calls | PASS |
| Zero TODOs in key handlers | grep TODO on listInvoices/getInvoice/finalizeInvoice | 0 matches | PASS |
| Admin check in all handlers | grep `userRoles.includes('admin')` | 9 files match (exceeds 7 required) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| BILL-01 | 01-01 | Billing schema includes all TODO fields | SATISFIED | All fields read from DB, zero TODOs in core handlers |
| BILL-02 | 01-01 | Billing Drizzle schema matches TypeSpec | SATISFIED | All columns verified present in billing.schema.ts |
| BILL-03 | 01-01 | Admin access checks enforced | SATISFIED | 9 handler files have admin role check |
| BILL-04 | 01-02 | E2E tests covering invoice lifecycle | PARTIAL | 19 tests pass covering create/finalize/pay/void. Refund excluded per D-05 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| markInvoiceUncollectible.ts | 112-129 | 10 TODOs with hardcoded nulls | Warning | Not in phase scope — pre-existing, not modified |
| createInvoice.ts | 123 | Tax calc returns 0 | Info | Intentional placeholder for future tax jurisdiction feature |
| updateInvoice.ts | 125 | Tax calc returns 0 | Info | Same as above |

### Human Verification Required

### 1. Schema Drift Confirmation

**Test:** Run `cd services/api-ts && bun run db:generate` in an interactive terminal
**Expected:** No new migration generated — confirms schema is in sync
**Why human:** db:generate requires interactive TTY (drizzle-kit promptColumnsConflicts)

### 2. Refund Exclusion Acceptance

**Test:** Confirm that excluding refund from lifecycle tests is acceptable
**Expected:** User acknowledges D-05 deferral; refund will be added in a future phase
**Why human:** Roadmap SC #4 explicitly says "create, pay, void, refund" but D-05 defers refund. No later phase in the roadmap covers it. User decision needed: accept deviation or add refund to a future phase.

### Gaps Summary

No hard blockers found. The implementation achieves the phase goal for all aspects except refund testing (intentionally deferred per user decision D-05). The `markInvoiceUncollectible.ts` handler was not in scope and retains pre-existing TODOs.

The two human verification items are:
1. A mechanical confirmation (db:generate) that couldn't run in automation
2. A scope decision about whether the refund exclusion needs to be tracked as a future roadmap item

---

_Verified: 2026-05-06T04:00:00Z_
_Verifier: Claude (gsd-verifier)_
