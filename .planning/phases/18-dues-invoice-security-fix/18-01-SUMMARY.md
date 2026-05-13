---
phase: 18-dues-invoice-security-fix
plan: "01"
subsystem: api-ts/handlers/association:member
tags: [tdd, security, rbac, org-isolation, red-phase]
dependency_graph:
  requires: []
  provides: [SEC-01-tests, SEC-02-tests]
  affects: [markDuesInvoicePaid, createDuesInvoice, updateDuesInvoice, deleteDuesInvoice, generateDuesInvoicesForOrg, getDuesInvoice, getDuesPayment, listDuesPayments, getDuesFinancialDashboard, generateDuesReport]
tech_stack:
  added: []
  patterns: [bun:test, mock.module, stubRepo, makeCtx, TDD-RED]
key_files:
  created:
    - services/api-ts/src/handlers/association:member/dues-mutation-auth.test.ts
    - services/api-ts/src/handlers/association:member/getDuesInvoice.test.ts
    - services/api-ts/src/handlers/association:member/getDuesPayment.test.ts
    - services/api-ts/src/handlers/association:member/listDuesPayments.test.ts
    - services/api-ts/src/handlers/association:member/getDuesFinancialDashboard.test.ts
  modified:
    - services/api-ts/src/handlers/association:member/markDuesInvoicePaid.test.ts
decisions:
  - "Cross-org test uses try/catch pattern to handle both Response(403) and ForbiddenError throw after Plan 02 fix"
  - "markDuesInvoicePaid.test.ts extended with SEC-01 describe block rather than replaced (preserves BR-07 tests)"
  - "generateDuesReport tests co-located in getDuesFinancialDashboard.test.ts (identical guard pattern, saves a file)"
  - "listDuesPayments cross-org test uses capturedFilter spy to assert repo receives ctx orgId not query param"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 18 Plan 01: Dues Invoice Security RED Tests Summary

RED-phase security test suite for 11 dues handlers lacking org-scoped RBAC — 37 tests across 6 files, 11 intentional RED failures documenting the exact security gaps Plan 02 must fix.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | RED tests for mutation handler auth (SEC-01) | e16539b | markDuesInvoicePaid.test.ts (+2 tests), dues-mutation-auth.test.ts (new, 6 tests) |
| 2 | RED tests for read handler org isolation (SEC-02) | 9dfc41e | getDuesInvoice.test.ts, getDuesPayment.test.ts, listDuesPayments.test.ts, getDuesFinancialDashboard.test.ts (4 new files, 19 tests) |

## Test Results (RED Phase)

| File | Pass | Fail (RED) | Total |
|------|------|-----------|-------|
| markDuesInvoicePaid.test.ts | 10 | 2 | 12 |
| dues-mutation-auth.test.ts | 0 | 6 | 6 |
| getDuesInvoice.test.ts | 2 | 1 | 3 |
| getDuesPayment.test.ts | 2 | 1 | 3 |
| listDuesPayments.test.ts | 2 | 1 | 3 |
| getDuesFinancialDashboard.test.ts | 8 | 2 | 10 |
| **Total** | **26** | **11** | **37** |

## RED Failures (Security Gaps to Fix in Plan 02)

### SEC-01: Mutation position checks missing

| Handler | Missing Guard | Test |
|---------|--------------|------|
| markDuesInvoicePaid | requirePosition([TREASURER, PRESIDENT]) | markDuesInvoicePaid.test.ts |
| markDuesInvoicePaid | org compare after fetch | markDuesInvoicePaid.test.ts |
| createDuesInvoice | requirePosition([TREASURER, PRESIDENT]) | dues-mutation-auth.test.ts |
| updateDuesInvoice | requirePosition([TREASURER, PRESIDENT]) | dues-mutation-auth.test.ts |
| updateDuesInvoice | org compare after fetch | dues-mutation-auth.test.ts |
| deleteDuesInvoice | requirePosition([TREASURER, PRESIDENT]) | dues-mutation-auth.test.ts |
| deleteDuesInvoice | org compare after fetch | dues-mutation-auth.test.ts |
| generateDuesInvoicesForOrg | body.organizationId vs ctx.get('organizationId') | dues-mutation-auth.test.ts |

### SEC-02: Read handler org isolation missing

| Handler | Missing Guard | Test |
|---------|--------------|------|
| listDuesPayments | passes query.organizationId to repo (must use ctx orgId) | listDuesPayments.test.ts |
| getDuesFinancialDashboard | requirePosition + route param vs ctx org | getDuesFinancialDashboard.test.ts |
| generateDuesReport | requirePosition + route param vs ctx org | getDuesFinancialDashboard.test.ts |

Note: getDuesInvoice and getDuesPayment cross-org tests use try/catch — they currently return 200 (bug), and after Plan 02 will either return Response(403) or throw ForbiddenError. Both patterns are handled.

## Deviations from Plan

### Auto-fixed Issues

None.

### Structural Adjustments

**1. [Rule 2 - Missing Critical Functionality] listDuesPayments RED test uses capturedFilter spy**
- Plan specified "capturedFilter or equivalent spy"
- Implementation uses exact spy pattern from plan action section
- Confirms repo receives ctx orgId ('org-1') not attacker query param ('attacker-org')

**2. markDuesInvoicePaid.test.ts extended, not replaced**
- Existing file had 10 BR-07 tests — plan's `<read_first>` was satisfied by reading the file
- Added new SEC-01 describe block, preserved all BR-07 tests
- Plan frontmatter listed the file as `files_modified`, not new — correct

## TDD Gate Compliance

RED gate: test commits exist (e16539b, 9dfc41e).
GREEN gate: not yet — Plan 02 will implement the fixes and the commits will have `feat(18-02): ...` type.

## Known Stubs

None. Tests use real handler imports with mocked repos and requirePosition.

## Self-Check

- [x] 6 test files created/modified
- [x] 37 test cases total (exceeds plan's 28 minimum)
- [x] 11 RED failures confirm security gaps
- [x] Commits e16539b and 9dfc41e exist
- [x] markDuesInvoicePaid.test.ts contains `requirePosition` in SEC-01 block (3 mock.module calls)
- [x] markDuesInvoicePaid.test.ts contains `organizationId: 'org-B'` and `organizationId: 'org-A'`
- [x] dues-mutation-auth.test.ts imports createDuesInvoice, updateDuesInvoice, deleteDuesInvoice, generateDuesInvoicesForOrg
- [x] dues-mutation-auth.test.ts contains `.toBe(403)` for position denial tests
- [x] dues-mutation-auth.test.ts contains cross-org test with `organizationId: 'org-B'` for update and delete
- [x] getDuesInvoice.test.ts contains `organizationId: 'org-B'`
- [x] getDuesPayment.test.ts contains `organizationId: 'org-B'`
- [x] listDuesPayments.test.ts contains `capturedFilter` spy
- [x] getDuesFinancialDashboard.test.ts contains `requirePosition`
- [x] getDuesFinancialDashboard.test.ts contains generateDuesReport tests
