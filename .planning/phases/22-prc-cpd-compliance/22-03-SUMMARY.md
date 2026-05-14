---
phase: 22-prc-cpd-compliance
plan: "03"
subsystem: training-credits
tags: [prc, cpd, compliance, training, credits, tdd]
dependency_graph:
  requires: [22-01]
  provides: [PRC-01, PRC-02, PRC-03]
  affects: [getCreditCompliance, createTraining, updateTraining, createCreditEntry, credits.repo]
tech_stack:
  added: []
  patterns: [TDD-vertical, batch-query-N+1-elimination, schema-default-enforcement]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/training/createTraining.ts
    - services/api-ts/src/handlers/training/updateTraining.ts
    - services/api-ts/src/handlers/association:member/createCreditEntry.ts
    - services/api-ts/src/handlers/association:member/getCreditCompliance.ts
    - services/api-ts/src/handlers/association:member/repos/credits.repo.ts
    - services/api-ts/src/handlers/training/createTraining.test.ts
    - services/api-ts/src/handlers/training/updateTraining.test.ts
    - services/api-ts/src/handlers/association:member/credits.test.ts
decisions:
  - "verificationStatus not accepted from client body — schema default 'pending' enforced (T-22-06)"
  - "sumCreditsByCategoryBatch fetched once before Promise.all to avoid N+1 pattern"
  - "accreditedProviderId stored without FK validation per RESEARCH.md (T-22-07 accepted)"
metrics:
  duration: "~20min"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 8
---

# Phase 22 Plan 03: PRC CPD Handler Updates + Compliance Summary

PRC fields wired into training/credit handlers and compliance endpoint extended with per-member category breakdown, using batch query to eliminate N+1.

## Tasks Completed

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | Wire PRC fields into training + credit entry handlers | 9dff02e (RED), f1cc673 (GREEN) | Done |
| 2 | Extend compliance handler with byCategory breakdown | 7df0103 (RED), 7ccaf76 (GREEN) | Done |

## What Was Done

### Task 1: PRC Fields in Handlers

**createTraining.ts** — Two new optional fields passed to `repo.create()`:
- `prcAccreditationNumber: body.prcAccreditationNumber`
- `accreditedProviderId: body.accreditedProviderId`

**updateTraining.ts** — No change needed. Fields flow through `...rest` since they were not in the destructure-and-discard list. Verified by test.

**createCreditEntry.ts** — Extended `CreateCreditEntryBody` interface with `category` and `approvalCode`. Both passed to `repo.createOne()`. `verificationStatus` intentionally NOT accepted from client — schema default `'pending'` enforced (T-22-06: elevation of privilege mitigation).

### Task 2: Category Breakdown in Compliance

**credits.repo.ts** — Added `sumCreditsByCategoryBatch(personIds[], cycleStart, cycleEnd, orgId)`:
- Single batched query using `inArray` + `groupBy(personId, category)`
- Returns `Map<personId, Record<category, total>>`
- Empty personIds guard returns early with empty map

**getCreditCompliance.ts** — Calls `sumCreditsByCategoryBatch` once before `Promise.all`, attaches `byCategory: categoryMap.get(personId) ?? {}` to each member result. Existing fields (earned, required, remaining, compliance_status) unchanged.

## Test Results

```
createTraining.test.ts:  6 pass, 0 fail
updateTraining.test.ts: 13 pass, 0 fail
credits.test.ts:        45 pass, 0 fail
Total:                  64 pass, 0 fail
```

## TDD Gate Compliance

- RED gate: `test(22-03)` commits precede implementation
- GREEN gate: `feat(22-03)` commits follow RED gates
- Both tasks followed RED → GREEN cycle correctly

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints introduced. All modified handlers were pre-existing. Threat mitigations applied:
- T-22-06: `verificationStatus` blocked from client body — schema default enforced
- T-22-08: `getCreditCompliance` `byCategory` addition stays within existing `requirePosition` gate

## Self-Check

- [x] `services/api-ts/src/handlers/training/createTraining.ts` — contains `prcAccreditationNumber`
- [x] `services/api-ts/src/handlers/training/updateTraining.ts` — PRC fields pass through `...rest`
- [x] `services/api-ts/src/handlers/association:member/createCreditEntry.ts` — contains `category`
- [x] `services/api-ts/src/handlers/association:member/getCreditCompliance.ts` — contains `byCategory`
- [x] `services/api-ts/src/handlers/association:member/repos/credits.repo.ts` — exports `sumCreditsByCategoryBatch`
- [x] Commits: 9dff02e, f1cc673, 7df0103, 7ccaf76 all exist in git log
- [x] All 64 tests pass

## Self-Check: PASSED
