---
phase: 13-position-based-rbac
plan: "03"
subsystem: backend-rbac
tags: [rbac, position-check, operations, events, training, courses]
dependency_graph:
  requires: [13-01]
  provides: [operations-position-guard]
  affects: [association:operations handlers]
tech_stack:
  added: []
  patterns: [requirePosition guard, POSITION_TITLES constants]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:operations/createEvent.ts
    - services/api-ts/src/handlers/association:operations/updateEvent.ts
    - services/api-ts/src/handlers/association:operations/deleteEvent.ts
    - services/api-ts/src/handlers/association:operations/publishEvent.ts
    - services/api-ts/src/handlers/association:operations/cancelEvent.ts
    - services/api-ts/src/handlers/association:operations/createCheckIn.ts
    - services/api-ts/src/handlers/association:operations/createTraining.ts
    - services/api-ts/src/handlers/association:operations/updateTraining.ts
    - services/api-ts/src/handlers/association:operations/deleteTraining.ts
    - services/api-ts/src/handlers/association:operations/publishTraining.ts
    - services/api-ts/src/handlers/association:operations/createCourse.ts
    - services/api-ts/src/handlers/association:operations/updateCourse.ts
    - services/api-ts/src/handlers/association:operations/deleteCourse.ts
decisions:
  - All 13 operations handlers now gate on Society Officer OR President (D-01)
metrics:
  duration: "5 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 13
---

# Phase 13 Plan 03: Operations Handlers Position RBAC Summary

**One-liner:** Replaced `requireOfficerTerm` with `requirePosition([SOCIETY_OFFICER, PRESIDENT])` in all 13 event/training/course operation handlers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire requirePosition to all 13 operations handlers | bd749d6 | 13 handler files |

## What Was Done

All 13 handlers in `services/api-ts/src/handlers/association:operations/` upgraded from the generic `requireOfficerTerm` check to position-specific `requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT])`.

Each file received exactly 2 changes:
1. Import: replaced `requireOfficerTerm` import with `requirePosition` + added `POSITION_TITLES` import
2. Guard call: replaced `requireOfficerTerm(ctx)` with `requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT])`

## Verification

- `grep -rl "requirePosition" src/handlers/association:operations/` → 13 files
- `grep -rl "requireOfficerTerm" src/handlers/association:operations/` → 0 files
- TypeScript typecheck: PASSED (all workspaces clean)
- ESLint: PASSED (auto-fixed, no errors)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan only tightens existing access control from "any officer" to "Society Officer or President". No new threat surface.

## Self-Check: PASSED

- All 13 handler files modified: CONFIRMED
- Commit bd749d6 exists: CONFIRMED
- No file deletions: CONFIRMED
- Zero `requireOfficerTerm` remaining in operations handlers: CONFIRMED
