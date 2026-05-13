---
phase: 15
plan: "02"
subsystem: dunning
tags: [dunning, dues, reminders, CRUD, schema]
dependency_graph:
  requires: []
  provides: [dunning-templates-crud, dunning-events-log, dunning-run]
  affects: [association:member handlers]
tech_stack:
  added: []
  patterns: [DatabaseRepository base class, paginated list response, org-scoped CRUD]
key_files:
  created:
    - services/api-ts/src/handlers/association:member/repos/dunning.schema.ts
    - services/api-ts/src/handlers/association:member/repos/dunning.repo.ts
    - services/api-ts/src/handlers/association:member/dunning.test.ts
    - services/api-ts/src/generated/migrations/0028_polite_roland_deschain.sql
  modified:
    - services/api-ts/src/handlers/association:member/createDunningTemplate.ts
    - services/api-ts/src/handlers/association:member/getDunningTemplate.ts
    - services/api-ts/src/handlers/association:member/listDunningTemplates.ts
    - services/api-ts/src/handlers/association:member/updateDunningTemplate.ts
    - services/api-ts/src/handlers/association:member/deleteDunningTemplate.ts
    - services/api-ts/src/handlers/association:member/runDunning.ts
    - services/api-ts/src/handlers/association:member/listDunningEvents.ts
decisions:
  - "Used 'letter' channel enum matching OpenAPI spec instead of 'in-app' from plan"
  - "Auth pattern uses user/orgId context (not session) matching existing association:member handlers"
  - "runDunning scaffolded with template evaluation; overdue membership matching deferred to integration"
metrics:
  duration: "~10m"
  completed: "2026-05-13"
  tasks: 7
  files_created: 4
  files_modified: 7
---

# Phase 15 Plan 02: Dunning Template CRUD Summary

Drizzle schema + repository + 7 handler implementations for dunning template management and event logging, replacing all DeferredScopeError stubs.

## What Was Built

1. **dunning.schema.ts** -- `dunning_template` and `dunning_event` tables with 3 enums (channel, delivery_status, template_status), indexes on org, stage, membership, template
2. **dunning.repo.ts** -- `DunningTemplateRepository` and `DunningEventRepository` extending DatabaseRepository base class with stage/channel/status filtering
3. **12 passing tests** covering CRUD, auth, pagination, run dunning, list events
4. **5 CRUD handlers** (create/get/list/update/delete) with org-scoped access control
5. **runDunning** handler with dryRun support and template evaluation
6. **listDunningEvents** handler with pagination and membershipId/stage filters
7. **DB migration** 0028 creating both tables and enums

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Channel enum mismatch**
- **Found during:** Task 1
- **Issue:** Plan specified `in-app` channel but OpenAPI spec uses `letter`
- **Fix:** Used `letter` to match the generated validator `DunningChannelSchema`
- **Files modified:** dunning.schema.ts

**2. [Rule 3 - Blocking] Pre-existing typecheck failures in worktree**
- **Found during:** Task 1 commit
- **Issue:** Missing `compute-membership-status.ts` and unbuilt `@monobase/api-spec` in worktree base commit
- **Fix:** Built api-spec, copied missing file from main worktree
- **Files modified:** None committed (worktree environment fix)

**3. [Rule 1 - Bug] noPropertyAccessFromIndexSignature TS errors**
- **Found during:** Task 4
- **Issue:** `UpdateDunningTemplateBody` requires bracket notation access per tsconfig
- **Fix:** Used `body as any` cast and bracket notation following existing handler patterns
- **Files modified:** updateDunningTemplate.ts

**4. [Rule 1 - Bug] ListDunningTemplatesQuery missing status/channel fields**
- **Found during:** Task 4
- **Issue:** Plan assumed status/channel query params but OpenAPI spec only has stage
- **Fix:** Removed status/channel filter code to match generated validator type
- **Files modified:** listDunningTemplates.ts

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| runDunning.ts | 44-48 | Overdue membership matching not implemented -- returns template count as `evaluated`, `sent` always 0. Needs integration with dues invoice overdue query. |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e3605ca | Create dunning schema |
| 2 | 09199f4 | Create repositories |
| 3 | 1d82872 | RED tests (12 passing) |
| 4 | 5edb711 | 5 CRUD handlers |
| 5 | d1cedef | runDunning handler |
| 6 | ad3a5d5 | listDunningEvents handler |
| 7 | 8f799ed | DB migration |

## Test Results

```
12 pass, 0 fail, 28 expect() calls
```

## Self-Check: PASSED

All 11 files verified present. All 7 commit hashes verified in git log.
