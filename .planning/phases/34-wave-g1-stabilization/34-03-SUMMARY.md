---
phase: 34-wave-g1-stabilization
plan: 03
subsystem: elections
tags: [testing, V-07, BR-34, election-integrity, nomination-eligibility]
dependency_graph:
  requires: []
  provides: [V-07-test-coverage, BR-34-e2e-coverage]
  affects: [elections]
tech_stack:
  added: []
  patterns: [handler-unit-test, e2e-integration-test]
key_files:
  created:
    - services/api-ts/src/handlers/elections/nomination-eligibility-e2e.test.ts
  modified:
    - services/api-ts/src/handlers/elections/updateElectionStatus.test.ts
decisions:
  - V-07 min-candidate guard covered by 5 dedicated unit tests
  - BR-34 E2E placed as backend integration test (not Playwright) since election UI not yet built
metrics:
  duration: 150s
  completed: 2026-05-20
  tasks: 3/3
  tests_added: 10
---

# Phase 34 Plan 03: Election Integrity and Nomination Eligibility Test Coverage Summary

V-07 min-candidate guard and BR-34 nomination eligibility gaps closed with 10 new tests (5 unit + 5 integration).

## Tasks Completed

| Task | Description | Commit | Tests Added |
|------|-------------|--------|-------------|
| 1 | V-07 min-candidate guard unit tests | 841fd58 | 5 |
| 2 | BR-34 nomination eligibility E2E integration tests | 0ab0a0d | 5 |
| 3 | Full election test suite verification | - | 131 pass / 0 fail |

## What Was Done

### Task 1: V-07 Min-Candidate Guard Tests
Added 5 tests to `updateElectionStatus.test.ts` covering:
- votingOpen with 0 nominees throws INSUFFICIENT_CANDIDATES
- votingOpen with 1 nominee per position throws INSUFFICIENT_CANDIDATES
- votingOpen with 2+ nominees per position succeeds
- Mixed positions (some under min) throws INSUFFICIENT_CANDIDATES with correct count
- nominationsOpen transition skips candidate check entirely

### Task 2: BR-34 Nomination Eligibility E2E Tests
Created `nomination-eligibility-e2e.test.ts` with 5 integration tests covering the full flow:
- Full lifecycle: open nominations then nominate eligible member (201)
- Non-active member rejected with NOMINEE_NOT_ACTIVE
- Insufficient tenure (< 6 months) rejected with NOMINEE_INSUFFICIENT_TENURE
- Suspended in another org rejected with NOMINEE_SUSPENDED
- Guard: nomination rejected when election still in draft

### Task 3: Verification
All 131 election tests pass across 15 files with 323 assertions. Zero failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed UUID validation in E2E tests**
- **Found during:** Task 2
- **Issue:** Test constants used non-UUID strings for positionId/personId, triggering VALIDATION_ERROR before eligibility checks
- **Fix:** Changed to valid UUID format (00000000-0000-4000-8000-...) matching existing test patterns
- **Files modified:** nomination-eligibility-e2e.test.ts
- **Commit:** 0ab0a0d

**2. [Rule 2 - Scope] E2E test placement**
- **Found during:** Task 2
- **Issue:** Plan frontmatter specified `apps/memberry/e2e/elections-nomination.spec.ts` but election UI doesn't exist in memberry app yet
- **Fix:** Placed as backend integration test at `services/api-ts/src/handlers/elections/nomination-eligibility-e2e.test.ts` per prompt override
- **Commit:** 0ab0a0d

## Known Stubs

None.

## Self-Check: PASSED
