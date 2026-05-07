---
phase: 04-typespec-openapi-reconciliation
plan: "08"
subsystem: api-ts/handlers
tags: [gap-closure, handler-stubs, imports, typecheck]
dependency_graph:
  requires: []
  provides: [clean-handler-stubs]
  affects: [services/api-ts/src/handlers/association:member, services/api-ts/src/handlers/association:operations]
tech_stack:
  added: []
  patterns: [stub-import-cleanup]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:member/*.ts (37 files)
    - services/api-ts/src/handlers/association:operations/*.ts (11 files)
decisions:
  - "Remove dead db import rather than stub it — stubs throw before any db usage"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-06T09:27:30Z"
---

# Phase 04 Plan 08: Fix Broken db Import in 48 Handler Stubs Summary

Removed dead `import { db } from '@/core/database'` from all 48 generated handler stubs in `association:member/` (37 files) and `association:operations/` (11 files). The `@/core/database` module does not export `db`; stubs throw "Not implemented" before any db usage, making the import dead code causing TypeScript compilation failures.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove broken db import from all 48 handler stubs | 63aeee6 | 48 handler stubs (-48 import lines) |
| 2 | Verify API service typecheck passes | n/a (verification only) | — |

## Verification Results

- `grep -rl "import { db } from '@/core/database'" ...` returns 0 files
- All 48 stubs retain their `throw new Error('Not implemented:` line
- `bunx tsc --noEmit`: no `@/core/database` or handler-stub db errors; remaining errors are pre-existing (orgId/organizationId schema mismatch, test utility issues from prior plans)

## Deviations from Plan

None — plan executed exactly as written. Pre-existing typecheck errors (orgId vs organizationId, response.body nullability in tests) are out of scope for this gap closure.

## Known Stubs

All 48 files are intentionally stubs — they throw "Not implemented" and will be wired in Phase 5+ handler implementation. This is by design.

## Threat Flags

None — import removal only, no new trust boundaries introduced.

## Self-Check: PASSED

- 48 files modified (confirmed via git diff --stat on commit 63aeee6)
- 0 stubs contain broken db import (confirmed via grep)
- 48 stubs retain throw line (confirmed via grep count)
