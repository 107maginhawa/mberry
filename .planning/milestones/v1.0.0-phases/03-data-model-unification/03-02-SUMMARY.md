---
phase: 03-data-model-unification
plan: 02
subsystem: handlers
tags: [tenantId, orgId, handler-consolidation, enum-standardization]
dependency_graph:
  requires: [03-01]
  provides: [no-tenantId-in-handlers, canonical-handler-modules]
  affects: [03-03]
tech_stack:
  added: []
  patterns: [middleware-context-cleanup, handler-module-consolidation]
key_files:
  deleted:
    - services/api-ts/src/handlers/training/repos/training.types.ts
    - services/api-ts/src/handlers/events/repos/events.types.ts
    - services/api-ts/src/handlers/membership/repos/membership.types.ts
    - services/api-ts/src/handlers/dues/repos/dues.types.ts
    - services/api-ts/src/handlers/communications/repos/communication.types.ts
    - services/api-ts/src/handlers/certificates/repos/certificates.types.ts
    - services/api-ts/src/handlers/elections/repos/elections.types.ts
    - services/api-ts/src/handlers/documents/repos/documents.types.ts
  modified:
    - services/api-ts/src/middleware/org-context.ts
    - services/api-ts/src/middleware/org-context.test.ts
    - services/api-ts/src/app.ts
decisions:
  - "Deleted 8 *.types.ts duplicate files rather than merging — canonical schemas in *.schema.ts are authoritative"
  - "Removed tenantId alias from org-context middleware — all handlers now read orgId only"
metrics:
  duration: retroactive
  completed: 2026-05-06
note: "Summary created retroactively — plan was executed but summary artifact missed. Code changes verified in 03-VERIFICATION.md."
---

# Phase 03 Plan 02: Handler Consolidation — Remove tenantId Glue + Delete Duplicates

**One-liner:** Removed tenantId context alias from middleware, deleted 8 duplicate `*.types.ts` handler files, and updated all handler imports to use canonical `*.schema.ts` paths.

## Tasks Completed

| Task | Name | Key Files |
|------|------|-----------|
| 1 | Remove tenantId from org-context middleware | org-context.ts, org-context.test.ts |
| 2 | Delete 8 duplicate *.types.ts files, update imports to *.schema.ts | 8 files deleted, app.ts updated |
| 3 | Standardize enum values to camelCase in association modules | Schema files updated in Plan 01 |

## What Was Built

- **Middleware cleanup:** `org-context.ts` no longer sets `ctx.var.tenantId` — only `orgId` is set. Tests updated to match.
- **Module consolidation:** 8 old handler `*.types.ts` files deleted. Each had a `pgTable()` definition that duplicated the canonical `*.schema.ts` version. All route registrations in `app.ts` updated to resolve to `association:*` canonical handler modules.
- **Enum standardization:** Association module enums use camelCase (no underscore values). Core Monobase modules (booking, comms, billing) retain snake_case — out of scope per D-06.

## Requirements

- DATA-01: Single canonical schema (no duplicate pgTable definitions)
- DATA-02: Consistent enum values across modules
- DATA-03: Translation glue code removed

## Self-Check

- [x] Zero tenantId references in org-context.ts: PASS
- [x] Zero *.types.ts files in handler repos/: PASS
- [x] All routes in app.ts resolve: PASS
- [x] org-context tests updated: PASS

## Self-Check: PASSED (retroactive)
