---
phase: 24-quality-gap-closure
plan: "01"
subsystem: audit
tags: [audit, typespec, codegen, filters, qal-02]
requirements: [QAL-02]

dependency_graph:
  requires: []
  provides: [audit-eventType-filter, audit-category-filter]
  affects: [specs/api/src/modules/audit.tsp, services/api-ts/src/generated/openapi/validators.ts, services/api-ts/src/handlers/audit/listAuditLogs.test.ts]

tech_stack:
  added: []
  patterns: [typespec-query-params, codegen-pipeline, filter-forwarding]

key_files:
  created: []
  modified:
    - specs/api/src/modules/audit.tsp
    - services/api-ts/src/generated/openapi/validators.ts
    - services/api-ts/src/handlers/audit/listAuditLogs.test.ts

decisions:
  - "Added eventType and category params after action param (before startDate) in listAuditLogs TypeSpec operation"
  - "No handler or repo changes needed — they already supported these filters; the only fix was in TypeSpec"

metrics:
  duration: "~8 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 24 Plan 01: Audit Log Filter Fix Summary

Audit log eventType/category query params were being stripped by Zod because they were missing from the TypeSpec definition — added both params and ran codegen to fix QAL-02.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add eventType + category @query params to audit.tsp and run codegen | fc56813 | specs/api/src/modules/audit.tsp, services/api-ts/src/generated/openapi/validators.ts |
| 2 | Add eventType + category filter test cases to listAuditLogs.test.ts | 2f16e45 | services/api-ts/src/handlers/audit/listAuditLogs.test.ts |

## What Was Done

**Task 1:** Added two `@query` parameters to the `listAuditLogs` operation in `audit.tsp`:
- `@query eventType?: AuditEventType`
- `@query category?: AuditCategory`

Ran the full codegen pipeline (`specs/api build` + `services/api-ts generate`). The `ListAuditLogsQuery` Zod schema in `validators.ts` now includes `eventType: AuditEventTypeSchema.optional()` and `category: AuditCategorySchema.optional()`.

**Task 2:** Added 3 test cases to `listAuditLogs.test.ts` following the `capturedFilters` pattern:
1. `eventType` filter forwarded to repo
2. `category` filter forwarded to repo
3. Combined `eventType + category` filters forwarded to repo

All 11 tests pass (8 pre-existing + 3 new).

## Deviations from Plan

None — plan executed exactly as written. Handler and repo already supported these filters; TypeSpec was the only change needed.

## Known Stubs

None.

## Threat Flags

None — no new network surface. eventType/category are validated against TypeSpec-defined enums by the generated Zod validators, org-scoping enforced by orgContextMiddleware.

## Self-Check: PASSED

- specs/api/src/modules/audit.tsp — modified, committed fc56813
- services/api-ts/src/generated/openapi/validators.ts — regenerated, committed fc56813
- services/api-ts/src/handlers/audit/listAuditLogs.test.ts — modified, committed 2f16e45
- All 11 audit tests pass
- ListAuditLogsQuery includes eventType and category fields
