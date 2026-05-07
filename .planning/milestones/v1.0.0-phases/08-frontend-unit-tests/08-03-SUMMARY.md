---
phase: 08-frontend-unit-tests
plan: 03
subsystem: ci
tags: [ci, vitest, unit-tests, github-actions]
dependency_graph:
  requires: [08-01]
  provides: [TEST-07-criteria-3]
  affects: [.github/workflows/ci.yml]
tech_stack:
  added: []
  patterns: [reuse-existing-ci-job]
key_files:
  modified:
    - .github/workflows/ci.yml
decisions:
  - Reuse unit-tests job rather than create a separate job — avoids extra checkout+install cycle; Postgres/MinIO services are harmless overhead for vitest
metrics:
  duration: 2m
  completed: 2026-05-06
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 08 Plan 03: CI Frontend Unit Test Step Summary

**One-liner:** Added `cd apps/memberry && bun run test` step to CI unit-tests job so vitest runs alongside backend bun tests on every push/PR.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add frontend unit test step to CI unit-tests job | 6fdb8eb | .github/workflows/ci.yml |

## What Was Built

Added a single step to the existing `unit-tests` job in `.github/workflows/ci.yml`:

```yaml
- name: Run frontend unit tests
  run: cd apps/memberry && bun run test
```

The step runs after `cd services/api-ts && bun test`. No new job, no new checkout or install cycle. The OpenAPI spec and codegen steps already execute before both test steps, so `@monobase/sdk-ts` and `@monobase/api-spec` workspace deps resolve correctly.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — CI configuration only, no security surface added.

## Self-Check: PASSED

- `.github/workflows/ci.yml` modified: FOUND
- Commit 6fdb8eb: FOUND
- `grep "Run frontend unit tests" .github/workflows/ci.yml`: matches line in unit-tests job
- Step appears after "Run unit tests" backend step
