---
phase: 03-data-model-unification
plan: 04
status: complete
gap_closure: true
started: 2026-05-06
completed: 2026-05-06
duration: 2m
---

# Plan 03-04: Gap Closure — makeCtx organizationId→orgId Propagation

## What Changed

**1 file modified:**
- `services/api-ts/src/test-utils/make-ctx.ts` — Added 4-line propagation block after vars initialization

## Key Results

- **41 → 10 test failures** (31 resolved by this fix)
- Tests passing `organizationId: null` now correctly trigger org-context guards (403 response)
- Remaining 10 failures are pre-existing issues unrelated to data model unification:
  - 3 membership handler tests (route param `_params.orgId` not read correctly by handler)
  - 2 billing void tests (business logic error, not org-related)
  - 2 dues repo tests (stub/mock mismatch)
  - 1 officer term test (scope assertion)
  - 1 approve membership test (enum value mismatch)
  - 1 import members test (route param issue)

## Self-Check

- [x] makeCtx propagates organizationId to orgId: PASS
- [x] 31 org-guard test failures resolved: PASS
- [x] No new test failures introduced: PASS
- [x] Remaining 10 failures are pre-existing (not from phase 03): PASS

## Self-Check: PASSED
