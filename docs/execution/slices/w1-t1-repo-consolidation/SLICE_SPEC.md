---
slice: w1-t1-repo-consolidation
phase: wave1-financial
priority: P1
---

# T1: Audit and Deprecate Legacy DuesRepository

## Goal
Consolidate duplicate DuesRepository classes. Two repos exist with overlapping methods but different return shapes — collectionRate returns 0-100 in one, 0.00-1.00 in the other. Standardize on association:member repo.

## Acceptance Criteria

- **AC-T1-001**: All handlers in `handlers/dues/` that import from `dues.repo.ts` are migrated to use `handlers/association:member/repos/dues-payments.repo.ts`
- **AC-T1-002**: `collectionRate` returns 0-100 (percentage integer) in all repo methods
- **AC-T1-003**: Legacy `DuesRepository.getDashboardStats()` in `handlers/dues/repos/dues.repo.ts` is marked `@deprecated` with JSDoc pointing to the canonical repo
- **AC-T1-004**: All existing tests pass after migration (zero regressions)

## Business Rules

- **BR-T1-001**: IF a handler imports `DuesRepository` from `handlers/dues/repos/dues.repo.ts` THEN it must be migrated to import from `handlers/association:member/repos/dues-payments.repo.ts`
- **BR-T1-002**: IF `collectionRate` is computed THEN it MUST be returned as 0-100 integer (percentage), never 0.00-1.00 decimal

## Files in Scope
- `services/api-ts/src/handlers/dues/repos/dues.repo.ts` — DEPRECATE methods
- `services/api-ts/src/handlers/association:member/repos/dues-payments.repo.ts` — canonical repo
- Any handlers in `handlers/dues/` importing from legacy repo

## Out of Scope
- Moving handler files between directories
- Changing handler route registrations
- Adding new endpoints
