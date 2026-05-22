---
phase: 35-wave-g2-training-membership-refactors
plan: 01
subsystem: training
tags: [bug-fix, credit-cycle, V-12, TDD]
dependency_graph:
  requires: []
  provides: [correct-cycle-anchoring]
  affects: [training/markComplete, flow-02, flow-020]
tech_stack:
  added: []
  patterns: [membership-lookup-for-cycle-anchor]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/training/markComplete.ts
    - services/api-ts/src/handlers/training/markComplete.test.ts
    - services/api-ts/src/handlers/training/flow-02.training-credit-award.test.ts
    - services/api-ts/src/handlers/training/flow-020.attendance-credit.test.ts
decisions:
  - "Use membership startDate as cycle anchor, fallback to activityDate with warning if no membership found"
  - "Assert cycle month anchoring (not year) since multi-year cycles roll forward"
metrics:
  duration: 8m
  completed: 2025-05-20
---

# Phase 35 Plan 01: Fix Credit Cycle Start Date (V-12) Summary

Fixed getCycleForDate call in markComplete to use member registration date instead of activity date as cycle anchor.

## What Changed

The `markComplete` handler was calling `getCycleForDate(activityDate, activityDate, 2)` -- using the training activity date as both the registration anchor AND target date. This caused every credit entry to start a fresh cycle anchored to the activity date, ignoring the member's actual registration date.

**Fix:** Look up the member's membership record via `MembershipRepository.findByPersonAndOrg()` to get their `startDate`, and pass that as the first argument to `getCycleForDate(registrationDate, activityDate, 2)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed downstream test files missing MembershipRepository stubs**
- **Found during:** Task 3 (verification)
- **Issue:** `flow-02.training-credit-award.test.ts` and `flow-020.attendance-credit.test.ts` called `markComplete` but did not stub `MembershipRepository`. After the handler gained a membership lookup dependency, the unstubbed call hit the real implementation on the mock DB, silently failing inside the try/catch and causing 6 test failures.
- **Fix:** Added `MembershipRepository` import, stub helper, and `restoreRepo` calls to both test files.
- **Files modified:** `flow-02.training-credit-award.test.ts`, `flow-020.attendance-credit.test.ts`
- **Commit:** 0e8c030

**2. [Rule 1 - Bug] Fixed fakeTraining missing organizationId field**
- **Found during:** Task 1 (RED)
- **Issue:** `fakeTraining` had `orgId` but not `organizationId`. The handler uses `training.organizationId` for the membership lookup.
- **Fix:** Added `organizationId: 'org-1'` to fakeTraining fixture.
- **Commit:** e542e90

## TDD Gate Compliance

- RED gate: `2620189` (test commit with failing assertions)
- GREEN gate: `e542e90` (feat commit with handler fix + corrected test assertions)
- Post-fix: `0e8c030` (downstream test file stubs)

## Verification

151 tests across 18 training test files -- all pass.

## Self-Check: PASSED
