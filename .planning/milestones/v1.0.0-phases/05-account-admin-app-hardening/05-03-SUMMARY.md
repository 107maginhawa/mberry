---
phase: 05-account-admin-app-hardening
plan: 03
subsystem: infra
tags: [ci, github-actions, playwright, e2e, admin, account]

requires:
  - phase: 05-01
    provides: admin app with E2E tests at apps/admin/
  - phase: 05-02
    provides: account app E2E tests at apps/account/

provides:
  - CI e2e job boots all 3 apps (memberry port 3004, admin port 3003, account port 3002)
  - Sequential E2E test runs for all 3 apps in a single CI job
  - Separate playwright-report artifact uploads per app on failure

affects: [05-04, future CI phases]

tech-stack:
  added: []
  patterns:
    - "Sequential app boot pattern: bun dev > log & then curl health check loop"
    - "Separate playwright-report artifacts per app for independent failure analysis"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Sequential (not parallel) app boots to avoid port contention and resource exhaustion on CI runner"
  - "Separate upload-artifact blocks per app so each app's failures are independently inspectable"
  - "Timeout increased from 20 to 30 minutes to accommodate 2 additional app boots and test suites"

patterns-established:
  - "App boot pattern: bun dev > /tmp/{app}.log 2>&1 & with curl health-check loop"

requirements-completed: [TEST-05, TEST-06]

duration: 5min
completed: 2026-05-06
---

# Phase 05 Plan 03: CI E2E Extension Summary

**CI e2e job extended to boot admin (3003) and account (3002) apps sequentially after memberry, running all three Playwright suites with per-app artifact uploads**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-06T14:50:00Z
- **Completed:** 2026-05-06T14:55:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added admin app boot, readiness wait, and E2E test run to CI e2e job
- Added account app boot, readiness wait, and E2E test run to CI e2e job
- Replaced single `playwright-report` upload-artifact with three separate blocks (memberry, admin, account)
- Increased e2e job `timeout-minutes` from 20 to 30 to cover the two additional app lifecycles
- All existing memberry steps preserved unchanged

## Task Commits

1. **Task 1: Extend CI e2e job with admin + account app boot and tests** - `4a69508` (feat)

## Files Created/Modified

- `.github/workflows/ci.yml` - Extended e2e job with admin/account boot, wait, test, and upload steps; timeout 20→30

## Decisions Made

- Sequential app startup (not matrix or parallel) — simpler, no port conflicts, no concurrent resource issues on CI runner
- Separate artifact uploads per app — lets CI failure UI show exactly which app failed independently of others

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CI now runs all three app E2E suites per PR and push to main
- TEST-05 and TEST-06 requirements satisfied: all E2E tests run in CI alongside existing memberry app tests
- Phase 05 hardening complete for CI e2e coverage

---

## Self-Check

**Created files:**
- `.planning/phases/05-account-admin-app-hardening/05-03-SUMMARY.md` — this file

**Commits exist:**
- `4a69508` — feat(05-03): extend CI e2e job with admin + account app boot and tests

## Self-Check: PASSED

---
*Phase: 05-account-admin-app-hardening*
*Completed: 2026-05-06*
