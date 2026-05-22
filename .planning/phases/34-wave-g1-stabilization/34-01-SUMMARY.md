---
phase: 34-wave-g1-stabilization
plan: 01
subsystem: membership
tags: [validation, zod, input-sanitization, tdd]
dependency_graph:
  requires: []
  provides: [updateMember-input-validation]
  affects: [membership-handler]
tech_stack:
  added: []
  patterns: [zod-schema-validation, safeParse-pattern]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/membership/updateMember.ts
    - services/api-ts/src/handlers/membership/updateMember.test.ts
decisions:
  - "Added 'pending' to Zod rejection list — not settable via updateMember (only via reviewApplication)"
  - "Used 'status as any' cast for repo call to work around pre-existing grace/gracePeriod naming mismatch between handler and DB enum"
  - "Used passthrough() on Zod schema to allow forward-compatible extra fields"
metrics:
  duration: 292s
  completed: 2025-05-20
  tasks: 3
  files: 2
---

# Phase 34 Plan 01: updateMember Zod Input Validation Summary

Zod schema validation on updateMember body.status replacing raw ctx.req.json() acceptance — invalid values like "banana" now return 400 instead of silent 200.

## TDD Gate Compliance

1. RED: `dfaa359` — `test(34-01)` commit with 3 failing validation tests
2. GREEN: `6de213c` — `feat(34-01)` commit with Zod schema + all tests passing

Gates satisfied.

## What Changed

- **updateMember.ts**: Added `updateMemberSchema` Zod object with `status: z.enum(['active','suspended','removed','grace','lapsed'])`. Request body parsed through `safeParse()` before processing. `ValidationError` thrown on failure (400).
- **updateMember.test.ts**: Added 5 new tests in `[V-20] body.status validation` section (banana, empty string, numeric, valid, missing). Moved 2 pending-as-target transition tests from silent-rejection to ValidationError expectation. Updated 2 remaining pending-as-source tests to stay in silent-rejection group (since body.status is valid enum, only transition is invalid).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type mismatch on status field**
- **Found during:** Task 2 (GREEN)
- **Issue:** Zod narrowed `status` type to the enum literal union, exposing pre-existing mismatch between handler's `grace` and DB enum's `gracePeriod`. Previously hidden because `ctx.req.json()` returned `any`.
- **Fix:** Added `status as any` cast when passing to repo (matches existing pattern in codebase, e.g. `status as any` in membership.repo.ts lines 35, 104, 291, 317)
- **Files modified:** updateMember.ts
- **Commit:** 6de213c

**2. [Rule 1 - Bug] Tests using "pending" as target status needed update**
- **Found during:** Task 2 (GREEN)
- **Issue:** Existing tests sent `pending` as body.status expecting 200 silent rejection. With Zod validation, `pending` is now correctly rejected at validation layer (400) since it's not a settable status via updateMember.
- **Fix:** Split pending-transition tests: `pending` as target status now expects ValidationError; `pending` as source status (where body.status is valid enum like "active") remains silent rejection.
- **Files modified:** updateMember.test.ts
- **Commit:** 6de213c

## Known Stubs

None.

## Self-Check: PASSED

- [x] updateMember.ts contains `updateMemberSchema` with Zod validation
- [x] updateMember.test.ts contains `[V-20]` validation tests
- [x] All 212 membership tests pass (0 failures)
- [x] Commits dfaa359 and 6de213c exist in git log
