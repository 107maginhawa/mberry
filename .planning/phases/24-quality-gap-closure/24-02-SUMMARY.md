---
phase: 24-quality-gap-closure
plan: "02"
subsystem: association-member
tags: [roster, br-registry, error-handling, qal-01, qal-03]
dependency_graph:
  requires: []
  provides: [QAL-01, QAL-03]
  affects: [services/api-ts/src/handlers/association:member/listRosterMembers.ts, docs/ver-3/business/br-registry.json]
tech_stack:
  added: []
  patterns: [defensive-error-handling, null-guard]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:member/listRosterMembers.ts
    - services/api-ts/src/handlers/association:member/listRosterMembers.test.ts
    - services/api-ts/src/utils/officer-check.ts
    - docs/ver-3/business/br-registry.json
decisions:
  - Wrap repo call in try/catch — return 500 with descriptive error instead of unhandled crash
  - Add null guard for positionTitle to prevent future TypeError if data ever deviates from schema
  - br-registry paths corrected: communications/ -> communication/ for BR-35 and BR-40
metrics:
  duration: ~8 minutes
  completed: "2026-05-13"
  tasks_completed: 2
  files_modified: 4
---

# Phase 24 Plan 02: Roster 500 Fix + BR Registry Summary

**One-liner:** Defensive try/catch in roster handler prevents unhandled 500s; br-registry.json paths corrected from `communications/` to `communication/` for BR-35 and BR-40.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Diagnose and fix roster API 500 (QAL-01) | 71b8613 | listRosterMembers.ts, listRosterMembers.test.ts, officer-check.ts |
| 2 | Fix br-registry.json paths for BR-35 and BR-40 (QAL-03) | 1347d4b | br-registry.json |

## What Was Done

### Task 1: Roster 500 Defensive Fix (QAL-01)

Diagnosis: Table names (`credit_entry`, `dues_invoice`) match actual pgTable definitions — no mismatch. The `positionTitle` field is `.notNull()` in schema. Guards in middleware and `requirePosition` are correct.

Root cause was absence of defensive error handling — any unexpected DB error (connection issue, migration mismatch at runtime) would crash as an unhandled rejection instead of returning a structured 500.

Fixes applied:
- Wrapped `repo.listMembersWithOfficerStatus()` in try/catch; returns `{ error: 'Failed to load roster' }` with HTTP 500 on any DB failure
- Added null guard for `positionTitle` in `requirePosition`: `((t.positionTitle as string) || '').toLowerCase()` — prevents future TypeError if data deviates
- Added error-path test: repo throws → handler returns 500 with error message

Test result: 12/12 pass (was 11/11).

### Task 2: BR Registry Path Fix (QAL-03)

BR-35 and BR-40 test files exist at `communication/` (singular), not `communications/` (plural). Registry had wrong paths. Fixed both entries. 24 tests pass across both files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing null guard] positionTitle null guard in requirePosition**
- Found during: Task 1 diagnosis
- Issue: `(t.positionTitle as string).toLowerCase()` would throw TypeError if positionTitle were null/undefined, despite schema being notNull (defensive correctness)
- Fix: Added `|| ''` fallback: `((t.positionTitle as string) || '').toLowerCase()`
- Files modified: `services/api-ts/src/utils/officer-check.ts`
- Commit: 71b8613

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Out-of-Scope Pre-existing Issues (Deferred)

Pre-existing typecheck errors noted during commit hooks (not caused by this plan):
- Duplicate `listFeatureFlags` identifier in `src/generated/openapi/registry.ts`
- `persons.email` missing from type in `membership.repo.ts`
- `db` export missing from `@/core/database` (system handlers)
- `memberry` app: `string | undefined` assignability error in providers.tsx

These are logged for tracking — not fixed here (out of scope per deviation rules).

## Self-Check

- [x] listRosterMembers.ts modified and committed (71b8613)
- [x] listRosterMembers.test.ts modified and committed (71b8613)
- [x] br-registry.json corrected and committed (1347d4b)
- [x] 12 roster tests pass
- [x] 24 BR-35+BR-40 tests pass
- [x] grep confirms `communication/br-35` (no trailing s) in registry

## Self-Check: PASSED
