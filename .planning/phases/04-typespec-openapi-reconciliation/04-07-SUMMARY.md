---
phase: 04-typespec-openapi-reconciliation
plan: 07
subsystem: frontend-sdk-migration
tags: [sdk-hooks, react-query, events, training, dues, membership, route-files, fetch-migration]
dependency_graph:
  requires: [04-05, 04-06]
  provides: [route-files-sdk-hooks]
  affects:
    - apps/memberry/src/routes/_authenticated/
    - apps/memberry/src/routes/_authenticated/org/$orgId/
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/
tech_stack:
  added: []
  patterns: [sdk-options-spread, mutationFn-extract, data-cast-any]
key_files:
  modified:
    - apps/memberry/src/routes/_authenticated/dashboard.tsx
    - apps/memberry/src/routes/_authenticated/my/events.tsx
    - apps/memberry/src/routes/_authenticated/my/training.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/events/$eventId.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/home.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/events/$eventId.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/events/$eventId/attendance.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/$paymentId.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/payments/index.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/reports/financial.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/roster/import.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/roster/index.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/funds.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/training/$trainingId.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/officer/training/$trainingId/attendance.tsx
    - apps/memberry/src/routes/_authenticated/org/$orgId/training/$trainingId.tsx
decisions:
  - "credits.tsx kept as-is — /api/credit-compliance endpoint not in SDK (not one of 6 in-scope modules)"
  - "generateDuesInvoicesForOrg requires periodStart/periodEnd — defaulted to full calendar year for reminder batch"
  - "checkInCustomEventMutation requires registrationId+personId in body — mutate call changed from memberId string to full reg object"
  - "home.tsx communications query preserved with api.get (out of scope) alongside migrated events query"
  - "dashboard.tsx, my/events.tsx, my/training.tsx were additional in-scope files not in plan filelist — migrated as Rule 2 completeness (zero-manual-fetch goal)"
  - "persons API call in roster/index.tsx AddMemberDialog kept with api.post — persons is not one of the 6 in-scope modules"
metrics:
  duration: 25m
  completed_date: "2026-05-06"
  tasks_completed: 1
  files_modified: 16
---

# Phase 04 Plan 07: Route Files SDK Migration Summary

Migrated 16 route files from manual api.get/api.post calls to generated SDK React Query hooks for events, training, dues, and membership modules. TypeScript typecheck passes. Zero manual fetch calls for the 6 in-scope modules across all route files.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Migrate 16 route files to SDK hooks + typecheck | 7d72e97 |

## Checkpoint Pending

Task 2 is a human-verify checkpoint — awaiting live app verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Migrated 3 additional route files not in plan filelist**
- **Found during:** Task 1 — grep verification showed 3 files still had manual events/training calls
- **Files:** dashboard.tsx, my/events.tsx, my/training.tsx
- **Fix:** Migrated these to SDK hooks (listMyCustomEventsOptions, listMyCustomTrainingsOptions, searchTrainingsOptions)
- **Commit:** 7d72e97

## Known Stubs

None — data is live via SDK hooks.

## Threat Flags

None — frontend data layer changed to typed SDK hooks; auth tokens still passed via SDK client transport.

## Self-Check: PASSED

- SUMMARY.md: FOUND
- Commit 7d72e97: FOUND
- TypeScript typecheck: 0 errors
- Zero manual fetch calls for 6 in-scope modules in routes: verified
