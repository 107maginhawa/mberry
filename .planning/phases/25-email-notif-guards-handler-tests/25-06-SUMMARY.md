---
phase: 25-email-notif-guards-handler-tests
plan: "06"
subsystem: api-ts/handlers
tags: [tests, unit-tests, handler-coverage, eml-05]
dependency_graph:
  requires: []
  provides: [handler-test-coverage-complete]
  affects: []
tech_stack:
  added: []
  patterns: [stubRepo, makeCtx, mock.module for officer-check, var-extended-ctx]
key_files:
  created:
    - services/api-ts/src/handlers/training/createAccreditedProvider.test.ts
    - services/api-ts/src/handlers/training/updateAccreditedProvider.test.ts
    - services/api-ts/src/handlers/training/deleteAccreditedProvider.test.ts
    - services/api-ts/src/handlers/training/listAccreditedProviders.test.ts
    - services/api-ts/src/handlers/training/listEnrollments.test.ts
    - services/api-ts/src/handlers/reviews/listReviews.test.ts
    - services/api-ts/src/handlers/reviews/getReview.test.ts
    - services/api-ts/src/handlers/reviews/deleteReview.test.ts
    - services/api-ts/src/handlers/events/listRegistrations.test.ts
    - services/api-ts/src/handlers/system/readiness.test.ts
    - services/api-ts/src/handlers/system/liveness.test.ts
    - services/api-ts/src/handlers/system/listFeatureFlags.test.ts
    - services/api-ts/src/handlers/booking/getBooking.test.ts
    - services/api-ts/src/handlers/booking/listBookings.test.ts
    - services/api-ts/src/handlers/booking/getBookingEvent.test.ts
    - services/api-ts/src/handlers/booking/listBookingEvents.test.ts
    - services/api-ts/src/handlers/booking/deleteBookingEvent.test.ts
    - services/api-ts/src/handlers/booking/updateBookingEvent.test.ts
    - services/api-ts/src/handlers/booking/getTimeSlot.test.ts
    - services/api-ts/src/handlers/booking/listEventSlots.test.ts
    - services/api-ts/src/handlers/booking/markNoShowBooking.test.ts
    - services/api-ts/src/handlers/booking/rejectBooking.test.ts
    - services/api-ts/src/handlers/booking/getScheduleException.test.ts
    - services/api-ts/src/handlers/booking/listScheduleExceptions.test.ts
    - services/api-ts/src/handlers/booking/createScheduleException.test.ts
    - services/api-ts/src/handlers/booking/updateScheduleException.test.ts
    - services/api-ts/src/handlers/booking/deleteScheduleException.test.ts
    - services/api-ts/src/handlers/membership/getOrgProfile.test.ts
    - services/api-ts/src/handlers/membership/listOrgApplications.test.ts
    - services/api-ts/src/handlers/membership/listOrgMembers.test.ts
    - services/api-ts/src/handlers/membership/updateOrgProfile.test.ts
    - services/api-ts/src/handlers/invite/validateInvite.test.ts
    - services/api-ts/src/handlers/system/readiness.ts
    - services/api-ts/src/handlers/system/liveness.ts
    - services/api-ts/src/handlers/system/listFeatureFlags.ts
  modified: []
decisions:
  - System handler stubs (readiness, liveness, listFeatureFlags) tested as throwing "Not implemented" — correct behavior for stub handlers; tests assert public access pattern
  - listOrgApplications and listOrgMembers use raw DB queries (no repo class); tests mock the database object at context level with query chain mocks
  - Handlers using c.var.logger (updateScheduleException, listBookingEvents) require ctx.var extension — added makeCtxWithVar helpers in affected tests
  - Handlers returning ctx.json(body) without status (validateInvite success, listBookingEvents) require json override defaulting to 200
  - System handler source files (readiness.ts, liveness.ts, listFeatureFlags.ts) copied to worktree — they existed in main but not in worktree branch
metrics:
  duration: "~45min"
  completed: "2026-05-13"
  tasks_completed: 2
  files_created: 35
---

# Phase 25 Plan 06: Training + Reviews + Events + System + Booking + Membership + Invite Handler Tests Summary

Unit test coverage for 32 remaining untested handlers across 7 modules — completes EML-05 final batch.

## Tasks Completed

### Task 1: Training + Reviews + Events + System (12 handlers)
- **Commit:** `712a95d`
- 5 training handler tests: accredited provider CRUD (4) + listEnrollments
- 3 reviews handler tests: listReviews (session + RBAC), getReview (owner/admin), deleteReview (owner/admin)
- 1 events handler test: listRegistrations (public, no auth)
- 3 system handler tests: readiness, liveness, listFeatureFlags (stub handlers, public endpoints)

### Task 2: Booking + Membership + Invite (20 handlers)
- **Commit:** `15e8d32`
- 15 booking handler tests: core booking CRUD, booking events CRUD, time slots, no-show/reject actions, schedule exceptions CRUD
- 4 membership handler tests: getOrgProfile, listOrgApplications, listOrgMembers (raw DB mock), updateOrgProfile (president-only)
- 1 invite handler test: validateInvite (token lifecycle: valid/claimed/revoked/expired)

## Verification

Final EML-05 verification:
```
training:    0 untested
reviews:     0 untested
events:      0 untested
system:      0 untested
booking:     0 untested
membership:  0 untested
invite:      0 untested
```

Full test run: **368 tests, 0 failures** across 53 files (includes pre-existing tests in those directories).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] System handler source files missing from worktree branch**
- **Found during:** Task 1 test verification
- **Issue:** readiness.ts, liveness.ts, listFeatureFlags.ts existed in main branch but not in worktree branch (worktree was branched before those files were added)
- **Fix:** Copied source files from main project to worktree
- **Files modified:** services/api-ts/src/handlers/system/{readiness,liveness,listFeatureFlags}.ts

**2. [Rule 1 - Bug] makeCtx `json` omits status when handler returns ctx.json(body)**
- **Found during:** Task 2 (validateInvite, listBookingEvents, updateScheduleException)
- **Issue:** Several handlers call `ctx.json(body)` without a status code; makeCtx's `json` function returns `{status: undefined}` in that case
- **Fix:** Added `makeCtxWithVar` / `makeCtxForInvite` helpers with `ctx.json = (body, status = 200) => ({status, body})`
- **Affected tests:** validateInvite, listBookingEvents, updateScheduleException

**3. [Rule 1 - Bug] makeCtx `param()` doesn't support no-arg call**
- **Found during:** Task 2 (deleteBookingEvent, updateBookingEvent)
- **Issue:** Handlers call `ctx.req.param()` with no args to get full params object; makeCtx's `param` only handles `param(key)` calls
- **Fix:** Added `makeCtxForDelete` / `makeCtxForUpdate` helpers that override `req.param` to support both `param()` and `param(key)`

**4. [Rule 1 - Bug] listBookingEvents uses `c.var['logger']` not `ctx.get('logger')`**
- **Found during:** Task 2
- **Issue:** Handler accesses logger via `c.var` property not context store
- **Fix:** Added `ctx.var = { logger: null }` in the test helper

## Known Stubs

The system handlers (readiness, liveness, listFeatureFlags) are themselves stub implementations that throw "Not implemented". Tests document this with "stub handler" comments and verify the public access pattern (no auth check before the stub throw).

## Threat Flags

None — test-only plan, no production code changes (except system handler source files copied from existing main branch implementation).

## Self-Check

Files created exist:
- `services/api-ts/src/handlers/training/createAccreditedProvider.test.ts` — FOUND
- `services/api-ts/src/handlers/booking/getBooking.test.ts` — FOUND
- `services/api-ts/src/handlers/invite/validateInvite.test.ts` — FOUND

Commits exist:
- `712a95d` — FOUND (Task 1)
- `15e8d32` — FOUND (Task 2)

## Self-Check: PASSED
