---
phase: 04-typespec-openapi-reconciliation
plan: 06
subsystem: frontend-sdk-migration
tags: [sdk-hooks, react-query, elections, certificates, events, training, fetch-migration]
dependency_graph:
  requires: [04-04]
  provides: [elections-sdk-hooks, certificates-sdk-hooks, events-sdk-hooks, training-sdk-hooks]
  affects:
    - apps/memberry/src/features/elections/components/
    - apps/memberry/src/features/certificates/components/
    - apps/memberry/src/features/events/components/
    - apps/memberry/src/features/training/components/
tech_stack:
  added: []
  patterns: [sdk-options-spread, mutationFn-extract, pagination-totalCount]
key_files:
  modified:
    - apps/memberry/src/features/elections/components/election-list.tsx
    - apps/memberry/src/features/elections/components/election-detail.tsx
    - apps/memberry/src/features/elections/components/election-form.tsx
    - apps/memberry/src/features/certificates/components/certificate-list.tsx
    - apps/memberry/src/features/certificates/components/certificate-preview.tsx
    - apps/memberry/src/features/events/components/attendance-view.tsx
    - apps/memberry/src/features/events/components/event-form.tsx
    - apps/memberry/src/features/events/components/event-list.tsx
    - apps/memberry/src/features/training/components/completion-table.tsx
    - apps/memberry/src/features/training/components/training-list.tsx
decisions:
  - "Extract mutationFn from mutation options object to avoid throwOnError type conflict with TanStack Query generics"
  - "Used data as any for election/event/training responses where SDK type fields differ from hand-wired API shape"
  - "Pagination totalCount field used (not total) — SDK pagination shape: { offset, limit, count, totalCount, totalPages, currentPage, hasNextPage, hasPreviousPage }"
  - "Election status transitions mapped to specific SDK endpoints: nominations_open->openElectionNominationsMutation, voting_open->openElectionVotingMutation, published->certifyElectionMutation"
  - "Election form maps old type:officer/bylaw to electionType:general/special for SDK"
metrics:
  duration: 18m
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_modified: 10
---

# Phase 04 Plan 06: Elections/Certificates/Events/Training SDK Migration Summary

Migrated 10 feature components from manual api.get/api.post calls to generated SDK React Query hooks from @monobase/sdk-ts.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Migrate elections + certificates (5 files) to SDK hooks | 93032c6 |
| 2 | Migrate events + training (5 files) to SDK hooks | 53b074f |

## What Was Done

### Task 1: Elections + Certificates

- **election-list.tsx**: Replaced `api.get('/api/elections/list/${orgId}')` with `listElectionsOptions({ query: { organizationId: orgId } })`
- **election-detail.tsx**: Replaced `api.get` with `getElectionOptions`; replaced single status mutation with three specific SDK mutations (`openElectionNominationsMutation`, `openElectionVotingMutation`, `certifyElectionMutation`)
- **election-form.tsx**: Replaced `api.post('/api/elections/create/${orgId}', body)` with `createElectionMutation`, mapped old field names (`type`, `positions` as objects) to SDK fields (`electionType`, `positions` as string IDs)
- **certificate-list.tsx**: Replaced `api.get('/api/certificates/my')` with `listMyCertificatesOptions()`
- **certificate-preview.tsx**: Replaced `api.get('/api/certificates/${certificateId}')` with `getCertificateOptions({ path: { certificateId } })`

### Task 2: Events + Training

- **event-list.tsx**: Replaced `api.get('/api/events/list/${orgId}')` with `searchEventsOptions`; replaced `api.post` cancel with `cancelEventMutation`; replaced stats dual-fetch with two separate `searchEventsOptions` queries
- **event-form.tsx**: Replaced `api.post`/`api.put` create/update with `createEventMutation`/`updateEventMutation`; used `mutationFn` extraction to avoid `throwOnError` generic conflict
- **attendance-view.tsx**: Replaced `api.get` attendance fetch with `listCustomEventAttendanceOptions`; replaced check-in `api.post` with `checkInCustomEventMutation`
- **training-list.tsx**: Replaced `api.get('/api/training/list/${orgId}')` with `searchTrainingsOptions`; replaced cancel with `cancelCustomTrainingMutation`
- **completion-table.tsx**: Replaced multi-query pattern with `listCustomTrainingEnrollmentsOptions`; replaced complete `api.post` with `completeCustomTrainingMutation`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fix React Hooks violation in election-detail.tsx**
- **Found during:** Task 1
- **Issue:** Initial implementation nested `useMutation` calls inside a helper function, violating React Hooks rules
- **Fix:** Moved all three mutations to top level; created `statusMutationPending` aggregating `.isPending`
- **Files modified:** election-detail.tsx
- **Commit:** 93032c6

**2. [Rule 1 - Bug] Fix pagination field name**
- **Found during:** Task 2 typecheck
- **Issue:** Used `pagination?.total` but SDK pagination type uses `totalCount` (shape: `{ offset, limit, count, totalCount, totalPages, currentPage, hasNextPage, hasPreviousPage }`)
- **Fix:** Replace all `.total` → `.totalCount` in event-list, training-list, completion-table
- **Files modified:** 3 files
- **Commit:** 53b074f

**3. [Rule 1 - Bug] Fix throwOnError type conflict**
- **Found during:** Task 1+2 typecheck
- **Issue:** Spreading `...createElectionMutation()` etc. into `useMutation()` causes TypeScript to complain about `throwOnError` generic mismatch
- **Fix:** Extract only `mutationFn` property instead of spreading entire options object
- **Files modified:** election-form, event-form, attendance-view
- **Commit:** 93032c6, 53b074f

## Known Stubs

None introduced by this plan. Existing stub in `completion-table.tsx`: the `attendance.totalCredits` stat shows `0` (not wired to real data from SDK) — pre-existing limitation as the SDK enrollment response doesn't include a credit total field. Tracking: this was already `0` before migration.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. SDK hooks use same authenticated client as prior manual fetch.

## Self-Check: PASSED

- All 10 target files exist
- Commits 93032c6 and 53b074f verified in git log
- Zero manual api.get/post calls remain in target files (verified via grep)
- TypeScript typecheck passes for all 10 migrated files
