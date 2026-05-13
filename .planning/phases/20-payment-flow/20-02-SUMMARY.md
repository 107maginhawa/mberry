---
phase: 20-payment-flow
plan: "02"
subsystem: api-ts/handlers/association:member
tags: [security, authorization, dues, payments, PAY-02]
dependency_graph:
  requires: []
  provides: [PAY-02-enforcement]
  affects: [listDuesPayments, officer-check]
tech_stack:
  added: []
  patterns: [requireOfficerTerm-for-access-level, effectivePersonId-pattern]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:member/listDuesPayments.ts
    - services/api-ts/src/handlers/association:member/listDuesPayments.test.ts
decisions:
  - "Use requireOfficerTerm null-check pattern to determine officer vs member access level without blocking member requests"
  - "effectivePersonId computed once before pagination logic; officer gets query.personId, member gets session.user.id"
  - "Used mock.module from bun:test (not property mutation) to stub ES module exports in tests"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-13T23:31:42Z"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 20 Plan 02: PAY-02 personId Self-Service Enforcement Summary

Enforced session-based personId restriction in `listDuesPayments` so members can only view their own payment receipts. Officers retain org-scoped access to any member's payments.

## What Was Built

JWT session-based personId enforcement for `GET /association/member/dues-payments`. Previously, any authenticated user could pass any `personId` in the query string and see another member's payment history (PAY-02 information disclosure gap). Now non-officer callers have their `personId` forced to `session.user.id` regardless of what they send.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Add failing PAY-02 tests | 584461c | listDuesPayments.test.ts |
| GREEN | Implement personId enforcement | 43d37e2 | listDuesPayments.ts |

## Implementation Details

**`listDuesPayments.ts` changes:**
- Added `import { requireOfficerTerm } from '@/utils/officer-check'`
- After org check, calls `requireOfficerTerm(ctx)` to detect officer status
- Computes `effectivePersonId`: `isOfficer ? query.personId : session.user.id`
- Passes `effectivePersonId` to `repo.listPayments()` instead of `query.personId`

**`listDuesPayments.test.ts` changes:**
- Added top-level `mock.module('@/utils/officer-check', ...)` for ES module compatibility
- Added `[PAY-02]` describe block with 4 tests:
  - Non-officer with different personId → forced to session.user.id
  - Non-officer with no personId → defaults to session.user.id
  - Officer with any personId → passes through unchanged
  - Officer with no personId → returns all org payments (undefined)

## TDD Gate Compliance

- RED commit: `584461c` — `test(20-02): add failing PAY-02 personId enforcement tests`
- GREEN commit: `43d37e2` — `feat(20-02): enforce PAY-02 personId restriction in listDuesPayments`

Gate sequence: RED → GREEN ✓

## Deviations from Plan

**1. [Rule 1 - Bug] ES module readonly property — switched to mock.module**
- **Found during:** RED phase test execution
- **Issue:** Plan suggested `(officerCheck as any).requireOfficerTerm = ...` but ES module named exports are readonly in Bun's runtime
- **Fix:** Used `mock.module('@/utils/officer-check', ...)` pattern (consistent with `markDuesInvoicePaid.test.ts` and other tests in the codebase)
- **Files modified:** listDuesPayments.test.ts
- **Commit:** 584461c

## Self-Check: PASSED

- `services/api-ts/src/handlers/association:member/listDuesPayments.ts` — FOUND
- `services/api-ts/src/handlers/association:member/listDuesPayments.test.ts` — FOUND
- Commit `584461c` — FOUND
- Commit `43d37e2` — FOUND
- `effectivePersonId` count in handler: 2 (>= 2 required) ✓
- `requireOfficerTerm` count in handler: 2 (>= 1 required) ✓
- `session.user.id` count in handler: 1 (>= 1 required) ✓
- `PAY-02` count in test: 6 (>= 1 required) ✓

## Known Stubs

None — enforcement is fully wired to session data.

## Threat Flags

T-20-05 (Information Disclosure) and T-20-06 (Elevation of Privilege) from the plan's threat model are now mitigated by this implementation.
