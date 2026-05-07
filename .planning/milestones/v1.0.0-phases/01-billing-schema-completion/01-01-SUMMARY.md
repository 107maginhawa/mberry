---
phase: 01-billing-schema-completion
plan: 01
subsystem: billing
tags: [billing, access-control, schema-alignment, response-mapping]
dependency_graph:
  requires: []
  provides: [complete-billing-responses, role-based-billing-access, void-threshold]
  affects: [billing-handlers, billing-repo, billing-schema]
tech_stack:
  added: []
  patterns: [admin-or-merchant-guard, customer-scoped-filtering, batch-line-items-fetch]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/billing/listInvoices.ts
    - services/api-ts/src/handlers/billing/getInvoice.ts
    - services/api-ts/src/handlers/billing/finalizeInvoice.ts
    - services/api-ts/src/handlers/billing/createInvoice.ts
    - services/api-ts/src/handlers/billing/updateInvoice.ts
    - services/api-ts/src/handlers/billing/deleteInvoice.ts
    - services/api-ts/src/handlers/billing/voidInvoice.ts
    - services/api-ts/src/handlers/billing/repos/billing.repo.ts
    - services/api-ts/src/handlers/billing/repos/billing.schema.ts
    - package.json
decisions:
  - "Used customerOrMerchant OR-filter in repo for non-admin list scoping (avoids dual queries)"
  - "Removed PersonRepository lookups from handlers that only need invoice.merchant == user.id"
  - "Fixed lint-staged config to use bunx + workspace eslint configs (pre-existing blocker)"
metrics:
  duration_seconds: 726
  completed: "2026-05-06T02:41:38Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 10
---

# Phase 01 Plan 01: Billing Handler Response Mapping + Access Controls Summary

Complete billing field mapping from DB, role-based access on all 7 handlers, void threshold enforcement per D-06.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Fix response mapping in listInvoices, getInvoice, finalizeInvoice | 46daabd | Replace hardcoded nulls with DB reads, batch line items fetch, findOneWithLineItems |
| 2 | Add access controls to all billing handlers | 786ffbb | Admin-or-merchant guard on all writes, customer-scoped reads, VOID_THRESHOLD_EXCEEDED |
| 3 | Schema alignment verification | (no changes) | Verified all columns present, db:generate needs TTY (pre-existing env issue) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] lint-staged eslint config broken (pre-existing)**
- **Found during:** Task 1 commit attempt
- **Issue:** lint-staged used `eslint --fix --max-warnings=0` but eslint not installed at root and config not found from root cwd
- **Fix:** Changed to `bunx eslint --fix --config services/api-ts/eslint.config.js` (workspace-aware)
- **Files modified:** package.json
- **Commit:** 46daabd

**2. [Rule 1 - Bug] updateInvoice response used stale parseFloat(amount) pattern**
- **Found during:** Task 2
- **Issue:** updateInvoice.ts was doing `parseFloat((updatedInvoice as any).amount)` instead of reading proper subtotal/total columns
- **Fix:** Read actual DB columns (subtotal, total, tax) and fetch line items via repo
- **Files modified:** services/api-ts/src/handlers/billing/updateInvoice.ts
- **Commit:** 786ffbb

**3. [Rule 1 - Bug] voidInvoice response hardcoded paymentCaptureMethod as 'manual'**
- **Found during:** Task 2
- **Issue:** voidInvoice.ts was returning hardcoded `paymentCaptureMethod: 'manual'` instead of DB value
- **Fix:** Read `updatedInvoice.paymentCaptureMethod` from DB
- **Files modified:** services/api-ts/src/handlers/billing/voidInvoice.ts
- **Commit:** 786ffbb

### Environment Issues

**db:generate TTY requirement (pre-existing, not caused by this plan)**
- drizzle-kit 0.31.10 requires interactive TTY for `promptColumnsConflicts`
- Schema alignment verified manually: all required columns present
- No schema changes were made by this plan (only TypeScript interface addition for customerOrMerchant filter)

## Known Stubs

None. All response fields now read from DB. The only remaining TODOs in billing handlers are:
- `createInvoice.ts:120` — tax calculation placeholder (returns 0, out of scope)
- `updateInvoice.ts` — tax calculation in line items update (returns 0, out of scope)

These are intentional business logic stubs for future tax jurisdiction support, not data mapping gaps.

## Threat Flags

None. All threat model mitigations (T-01-01 through T-01-05) implemented as planned.

## Self-Check: PASSED
