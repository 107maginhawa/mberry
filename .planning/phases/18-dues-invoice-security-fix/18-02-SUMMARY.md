---
phase: 18-dues-invoice-security-fix
plan: "02"
subsystem: api-ts/handlers/association:member
tags: [security, rbac, org-scope, dues, sec-01, sec-02]
dependency_graph:
  requires: [18-01]
  provides: [dues-handler-rbac-green]
  affects: [dues-invoices, dues-payments, dues-reporting]
tech_stack:
  added: []
  patterns: [requirePosition-guard, cross-org-isolation, ctx-org-over-query-org]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts
    - services/api-ts/src/handlers/association:member/createDuesInvoice.ts
    - services/api-ts/src/handlers/association:member/updateDuesInvoice.ts
    - services/api-ts/src/handlers/association:member/deleteDuesInvoice.ts
    - services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts
    - services/api-ts/src/handlers/association:member/listDuesInvoices.ts
    - services/api-ts/src/handlers/association:member/getDuesInvoice.ts
    - services/api-ts/src/handlers/association:member/listDuesPayments.ts
    - services/api-ts/src/handlers/association:member/getDuesPayment.ts
    - services/api-ts/src/handlers/association:member/getDuesFinancialDashboard.ts
    - services/api-ts/src/handlers/association:member/generateDuesReport.ts
    - services/api-ts/src/handlers/association:member/markDuesInvoicePaid.test.ts
    - services/api-ts/src/handlers/association:member/dues-mutation-auth.test.ts
decisions:
  - requirePosition throws ForbiddenError (exception) for cross-org checks — tests updated to use try/catch to handle both Response and exception patterns
  - fakeInvoice.organizationId aligned to makeCtx default ('tenant-1') to prevent cross-org false positives in BR-07 tests
  - generateDuesInvoicesForOrg replaces all body.organizationId with trusted ctx orgId after guard validation
metrics:
  duration: "~25 minutes"
  completed: "2026-05-13"
  tasks_completed: 3
  files_modified: 13
requirements: [SEC-01, SEC-02]
---

# Phase 18 Plan 02: Dues Handler RBAC Green Phase Summary

Applied org-scoped RBAC to all 11 dues handlers — 5 mutation handlers get requirePosition([TREASURER, PRESIDENT]) guard, 6 read handlers get cross-org isolation with ForbiddenError.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | requirePosition + cross-org guard on 5 mutation handlers (SEC-01) | 967d0f1 |
| 2 | Org-scope isolation on 6 read/query handlers (SEC-02) | 8e1ea93 |
| 3 | Full regression verification — 2414 tests pass, 0 fail | (no commit needed) |

## What Was Done

### Task 1 — Mutation Handlers (SEC-01)

- **markDuesInvoicePaid**: Added `requirePosition([TREASURER, PRESIDENT])` at entry + `invoice.organizationId !== orgId` cross-org check after fetch
- **createDuesInvoice**: Replaced `ctx.get('user')` + manual 401/403 pattern with `requirePosition` guard + `session.user.id` fallback for personId
- **updateDuesInvoice**: Added `requirePosition` + `existing.organizationId !== orgId` cross-org check
- **deleteDuesInvoice**: Added `requirePosition` + `existing.organizationId !== orgId` cross-org check
- **generateDuesInvoicesForOrg**: Added `body.organizationId !== orgId` cross-org guard after requirePosition; replaced all `body.organizationId` references with trusted `orgId`

### Task 2 — Read/Query Handlers (SEC-02)

- **listDuesInvoices**: Added null guard `if (!orgId) throw new ForbiddenError()` (belt-and-suspenders)
- **listDuesPayments**: Enforced `ctx.get('organizationId')` for repo call, removed IDOR vector `query.organizationId`
- **getDuesInvoice**: Added `if (!orgId)` null guard + `invoice.organizationId !== orgId` cross-org check after fetch
- **getDuesPayment**: Added `if (!orgId)` null guard + `payment.organizationId !== orgId` cross-org check after fetch
- **getDuesFinancialDashboard**: Added `requirePosition([TREASURER, PRESIDENT])` + route param vs ctx org verification
- **generateDuesReport**: Added `requirePosition([TREASURER, PRESIDENT])` + route param vs ctx org verification

### Task 3 — Regression Verification

Full test suite: **2414 pass, 0 fail** (2417 total — 3 todo).

Spot checks:
- `requirePosition` present in 6 dues handlers: createDuesInvoice, markDuesInvoicePaid, updateDuesInvoice, deleteDuesInvoice, getDuesFinancialDashboard, generateDuesReport
- `ForbiddenError` present in all 11 handlers
- `query.organizationId` removed from listDuesPayments repo call

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ForbiddenError throws instead of Response in cross-org checks**
- **Found during:** Task 1 verification
- **Issue:** Tests expecting `res.status === 403` received thrown `ForbiddenError` exceptions instead. The plan specified `throw new ForbiddenError()` but tests used `expect(res.status).toBe(403)` without try/catch.
- **Fix:** Updated cross-org test assertions in `markDuesInvoicePaid.test.ts` and `dues-mutation-auth.test.ts` to use try/catch pattern (consistent with `getDuesInvoice.test.ts` which already had this pattern).
- **Files modified:** markDuesInvoicePaid.test.ts, dues-mutation-auth.test.ts

**2. [Rule 1 - Bug] fakeInvoice.organizationId mismatch with makeCtx default**
- **Found during:** Task 1 verification
- **Issue:** Existing `[BR-07]` tests used `fakeInvoice.organizationId: 'org-1'` but `makeCtx` defaults `organizationId` to `'tenant-1'`. New cross-org check rejected them.
- **Fix:** Changed `fakeInvoice.organizationId` and `fakeMembership.organizationId` to `'tenant-1'` (the makeCtx default).
- **Files modified:** markDuesInvoicePaid.test.ts

**3. [Rule 1 - Bug] createDuesInvoice referenced undefined `user.id`**
- **Found during:** Task 1 implementation
- **Issue:** Removing `const user = ctx.get('user')` left `body.personId || user.id` referencing undefined `user`. 
- **Fix:** Changed to `body.personId || session.user.id` (session already extracted at that point).
- **Files modified:** createDuesInvoice.ts

## Security Coverage

| Threat | Handler | Guard Applied |
|--------|---------|--------------|
| T-18-01 EoP | markDuesInvoicePaid, createDuesInvoice, updateDuesInvoice, deleteDuesInvoice | requirePosition([TREASURER, PRESIDENT]) |
| T-18-02 InfoDisc | getDuesInvoice, getDuesPayment | cross-org check after fetch |
| T-18-03 Tampering | listDuesPayments | ctx.get('organizationId') replaces query.organizationId |
| T-18-04 EoP | getDuesFinancialDashboard, generateDuesReport | requirePosition + route param vs ctx org |
| T-18-05 Tampering | generateDuesInvoicesForOrg | body.organizationId !== orgId guard |
| T-18-06 EoP | listDuesInvoices | null guard on orgId (belt-and-suspenders) |

## Known Stubs

None — all security mitigations are fully wired.

## Self-Check

- [x] All 11 handler files modified with auth guards
- [x] markDuesInvoicePaid.ts contains `requirePosition` — FOUND
- [x] createDuesInvoice.ts does NOT contain `const user = ctx.get('user')` as primary auth — CONFIRMED
- [x] listDuesPayments.ts uses `orgId` (not `query.organizationId`) for repo call — CONFIRMED
- [x] getDuesInvoice.ts contains `ForbiddenError` — FOUND
- [x] getDuesFinancialDashboard.ts contains `requirePosition` — FOUND
- [x] Full test suite: 2414 pass, 0 fail — CONFIRMED
- [x] Commits 967d0f1 and 8e1ea93 exist — CONFIRMED

## Self-Check: PASSED
