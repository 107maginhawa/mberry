---
phase: 04-typespec-openapi-reconciliation
plan: 04
subsystem: api-generation
tags: [typespec, openapi, sdk, route-decommission, code-generation]
dependency_graph:
  requires: [04-03]
  provides: [generated-routes-all-modules, sdk-hooks-all-modules, clean-app-ts]
  affects: [services/api-ts/src/app.ts, services/api-ts/src/generated/openapi/, packages/sdk-ts/src/generated/]
tech_stack:
  added: []
  patterns: [3-step-build-pipeline, spec-first-route-generation, openapi-ts-sdk-gen]
key_files:
  created:
    - services/api-ts/src/handlers/association:member/ (48 new handler stubs)
    - services/api-ts/src/handlers/association:operations/ (handler stubs)
  modified:
    - services/api-ts/src/generated/openapi/routes.ts
    - services/api-ts/src/generated/openapi/validators.ts
    - services/api-ts/src/generated/openapi/registry.ts
    - packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts
    - packages/sdk-ts/src/generated/types.gen.ts
    - packages/sdk-ts/src/generated/sdk.gen.ts
    - services/api-ts/src/app.ts
decisions:
  - "Keep communications route hand-wired — announcements module not in Phase 4 TypeSpec scope"
  - "Keep registerDuesJobs import — still invoked at app startup line 438"
  - "Auto-fixed findByOrg(orgId, orgId) -> findByOrg(orgId) per correct 1-arg signature"
metrics:
  duration: 10m
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_modified: 60
---

# Phase 04 Plan 04: Build Pipeline + Route Decommission Summary

3-step code generation pipeline executed; 6 hand-wired routes decommissioned from app.ts; SDK React Query hooks generated for all custom modules.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Run 3-step build pipeline (TypeSpec→OpenAPI→Hono routes→SDK) | 584aafb |
| 2 | Verify role annotations, decommission 6 hand-wired routes from app.ts | eddb9d1 |

## What Was Done

### Task 1: 3-Step Build Pipeline

- **Step 1** `cd specs/api && bun run build` — TypeSpec compiled to OpenAPI JSON (438 warnings, all pre-existing)
- **Step 2** `cd services/api-ts && bun run generate` — Generated routes.ts, validators.ts, registry.ts; 48 new handler stubs created
- **Step 3** `cd packages/sdk-ts && bun run generate` — Generated React Query hooks for all custom modules

Generated SDK hooks verified present:
- `listElectionsOptions`
- `listMyCertificatesOptions`
- `listDuesPaymentsOptions`
- `listRosterMembersOptions`

OpenAPI paths check: 124 matches for `election|certificate|dues-payment|roster|event-lifecycle|training-lifecycle`

### Task 2: Route Decommission

Pre-check passed: all 6 module paths confirmed in generated routes.ts with 269 auth enforcement references.

Removed from `services/api-ts/src/app.ts`:
- 6 `app.use('/{module}/*', authMiddleware())` lines
- 6 `app.route('/{module}', ...)` lines
- 6 dead imports (`dues`, `membership`, `certificates`, `eventsRouter`, `trainingRouter`, `electionsRouter`)

Preserved:
- `app.use('/communications/*', authMiddleware())`
- `app.route('/communications', communications)`
- `import { communications } from '@/handlers/communications'`
- `import { registerDuesJobs } from '@/handlers/dues/jobs'` (still invoked at startup)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed findByOrg called with 2 args instead of 1**
- **Found during:** Task 2 typecheck after route removal
- **Issue:** `termRepo.findByOrg(orgId, orgId)` and `posRepo.findByOrg(orgId, orgId)` passed 2 args; `findByOrg(organizationId: string)` only accepts 1
- **Fix:** Removed duplicate `orgId` argument from both calls
- **Files modified:** `services/api-ts/src/app.ts` (lines 139-140)
- **Commit:** eddb9d1

## Threat Model Compliance

| Threat | Status |
|--------|--------|
| T-04-09: Elevation of Privilege (route decommission) | Mitigated — 269 auth references in generated routes.ts confirmed before removal |
| T-04-10: Denial of Service (missing routes) | Mitigated — all 6 module path prefixes confirmed in routes.ts before decommission |

## Known Stubs

The generator created 48 handler stubs in `services/api-ts/src/handlers/association:member/` and `association:operations/`. These stubs return `501 Not Implemented` by default and will be wired up in Phase 05 (handler implementation). This is intentional — stubs exist to hold generated function signatures.

## Self-Check: PASSED

- services/api-ts/src/app.ts: FOUND
- packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts: FOUND
- commit 584aafb: FOUND (build pipeline)
- commit eddb9d1: FOUND (route decommission)
