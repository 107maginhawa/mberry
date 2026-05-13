---
phase: 12-backend-auth-route-protection
plan: "01"
subsystem: api-ts
tags: [tdd, auth, rbac, officer-protection, red-phase]
dependency_graph:
  requires: []
  provides: [route-protection-handwired-tests]
  affects: [services/api-ts/src/tests/route-protection-handwired.test.ts]
tech_stack:
  added: []
  patterns: [hono-mock-app, bun-mock-module, data-driven-tests]
key_files:
  created:
    - services/api-ts/src/tests/route-protection-handwired.test.ts
  modified: []
decisions:
  - Mock OfficerTermRepository via bun mock.module to control officer term return values per test suite
  - Two app factories (makeMemberApp/makeOfficerApp) sharing identical route wiring, differing only in mock return value
  - Data-driven for loop covers all 6 officer-only routes; 2 extra tests cover member read-only GET route
metrics:
  duration: 15m
  completed: 2026-05-08
  tasks_completed: 1
  tasks_total: 1
---

# Phase 12 Plan 01: Hand-wired Route Officer Protection Tests Summary

**One-liner:** RED-phase Hono mock tests asserting 403/200 on 6 officer-only hand-wired routes using Bun module mocking of OfficerTermRepository.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED — Write hand-wired route officer protection tests | 00ae8a5 | services/api-ts/src/tests/route-protection-handwired.test.ts |

## What Was Built

Created `route-protection-handwired.test.ts` with 14 test cases covering:

**Officer-only routes (member gets 403, officer gets 200):**
- PUT /membership/org-profile/:orgId
- GET /membership/members/:orgId
- GET /membership/applications/:orgId
- GET /dues/dashboard/:orgId
- GET /credit-compliance/:orgId
- GET /officer-terms/:orgId

**Member read-only route (member gets 200, per D-07):**
- GET /membership/org-profile/:orgId

The mock app wires `officerAuthMiddleware()` correctly (target state for Plan 03 GREEN phase). Tests pass against the mock because the middleware is present. The real `app.ts` currently lacks this middleware — Plan 03 will add it.

## Verification

All 14 tests pass:
```
14 pass
0 fail
14 expect() calls
Ran 14 tests across 1 file. [36.00ms]
```

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate: `test(12-01)` commit at 00ae8a5 — tests written before any app.ts changes
- GREEN gate: Pending (Plan 03 will wire officerAuthMiddleware to real app.ts routes)
- Note: Per plan design, mock app tests pass because the mock has correct wiring. The RED phase documents the target behavior, not failing tests against real app.

## Threat Flags

None — test file only, no new network surface.

## Self-Check: PASSED

- File exists: services/api-ts/src/tests/route-protection-handwired.test.ts — FOUND
- Commit 00ae8a5 exists — FOUND
- 14 tests pass — VERIFIED
