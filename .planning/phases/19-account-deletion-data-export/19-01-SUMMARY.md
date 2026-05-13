---
phase: 19-account-deletion-data-export
plan: "01"
subsystem: person
tags: [deletion, privacy, dpa, jobs, export, session-cleanup]
dependency-graph:
  requires: []
  provides:
    - processDeletions scheduled job (DPA-06)
    - DELETED/deleted@deleted.invalid anonymization (DPA-02)
    - Better-Auth session cleanup on deletion (DPA-02 / T-19-05)
    - Certificates + events in data export (DPA-04)
    - PII-free audit logs during anonymization (DPA-05)
  affects:
    - services/api-ts/src/handlers/person/executeAccountDeletion.ts
    - services/api-ts/src/app.ts
tech-stack:
  added: []
  patterns:
    - TDD RED/GREEN per task
    - Job registration pattern (registerPersonJobs → registerCron daily midnight)
    - Dynamic import try/catch for optional data collection in export
    - Per-person try/catch in batch job for fault isolation
key-files:
  created:
    - services/api-ts/src/handlers/person/jobs/deletionProcessor.ts
    - services/api-ts/src/handlers/person/jobs/index.ts
    - services/api-ts/src/handlers/person/jobs/deletionProcessor.test.ts
  modified:
    - services/api-ts/src/handlers/person/executeAccountDeletion.ts
    - services/api-ts/src/handlers/person/exportPersonData.ts
    - services/api-ts/src/handlers/person/requestAccountDeletion.test.ts
    - services/api-ts/src/handlers/person/exportPersonData.test.ts
    - services/api-ts/src/app.ts
decisions:
  - "Use phone: undefined (not null) to match ContactInfo interface — phone field is optional not nullable"
  - "Audit details contain only {personId, originalRequestDate} — no name/email/phone (DPA-05)"
  - "Session cleanup fires before PII scrub to ensure no re-auth on deleted account (T-19-05)"
metrics:
  duration: "35 minutes"
  completed: "2026-05-13T22:52:34Z"
  tasks-completed: 2
  tasks-total: 2
  tests-added: 15
  files-created: 3
  files-modified: 6
---

# Phase 19 Plan 01: Account Deletion + Data Export Backend Summary

**One-liner:** Scheduled PII anonymization job (DELETED/deleted@deleted.invalid), Better-Auth session cleanup, and certificates+events in GDPR-style data export.

## Tasks Completed

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | Fix anonymization fields + session cleanup + deletion processor job | 8a56cee, 7f61cd8, e4dedf0 | executeAccountDeletion.ts, jobs/deletionProcessor.ts, jobs/index.ts, app.ts, requestAccountDeletion.test.ts |
| 2 | Complete data export with certificates + events | 117441d, d1cf20c | exportPersonData.ts, exportPersonData.test.ts |

## What Was Built

### Task 1: Deletion Processor Job (DPA-02, DPA-05, DPA-06)

**`executeAccountDeletion.ts` fixes:**
- firstName changed from `'Deleted'` to `'DELETED'`
- lastName changed from `'User'` to `'DELETED'`
- contactInfo changed from `null` to `{ email: 'deleted@deleted.invalid', phone: undefined }`
- Added Better-Auth session cleanup: `db.delete(schema.session).where(userId = personId)` fires BEFORE PII scrub

**New `jobs/deletionProcessor.ts`:**
- `processDeletions({ db, logger, audit? })` queries `persons WHERE deletionScheduledAt < now AND deletionCompletedAt IS NULL`
- Per-person try/catch — one failure does not halt the batch
- Anonymizes same fields as executeAccountDeletion
- Deletes Better-Auth sessions per person
- Audit logEvent details contain ONLY `{ personId, originalRequestDate }` — no PII

**New `jobs/index.ts`:**
- `registerPersonJobs(scheduler)` — cron `'0 0 * * *'` (daily midnight)
- Registered in `app.ts` alongside other module jobs

### Task 2: Data Export Certificates + Events (DPA-04)

**`exportPersonData.ts` additions:**
- Certificates block: dynamic import `@/handlers/certificates/repos/certificates.schema`, queries by `personId`, wrapped in try/catch
- Events block: dynamic import `@/handlers/association:operations/repos/events.schema`, queries `eventRegistrations` by `personId`, wrapped in try/catch
- Both added to `categories` array when non-empty
- Both included in JSON response

## Test Coverage

- 9 new tests in `deletionProcessor.test.ts` covering all processDeletions behaviors
- 1 new DPA-05 PII audit test in `requestAccountDeletion.test.ts`
- 6 new tests in `exportPersonData.test.ts` for certificates/events
- Updated 2 existing tests to match DELETED/contactInfo spec change
- **Total: 69 tests across 7 person handler files, 0 failures**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] phone: null type mismatch**
- **Found during:** Task 1 GREEN commit (typecheck hook)
- **Issue:** `ContactInfo.phone` is `string | undefined`, not `string | null`. Setting `phone: null` caused TS2322 errors.
- **Fix:** Changed to `phone: undefined` in both executeAccountDeletion.ts and deletionProcessor.ts; updated tests accordingly
- **Files modified:** executeAccountDeletion.ts, deletionProcessor.ts, requestAccountDeletion.test.ts, deletionProcessor.test.ts
- **Commit:** e4dedf0

**2. [Rule 3 - Blocking] Worktree missing node_modules and api-spec dist**
- **Found during:** First commit attempt
- **Issue:** Worktree had no node_modules; ESLint pre-commit hook failed with "Cannot find package @monobase/eslint-config"; typecheck failed with missing api-spec types
- **Fix:** `bun install --ignore-scripts`, created `@monobase/eslint-config` and `@monobase/typescript-config` symlinks in root node_modules, built `specs/api` to generate dist
- **Files modified:** node_modules symlinks (not committed — runtime setup)

## Known Stubs

None — all data is wired to real database queries.

## Threat Surface Scan

No new network endpoints, auth paths, or trust boundaries introduced. The deletion processor runs as a system job (no HTTP surface). Session cleanup in both executeAccountDeletion and deletionProcessor matches T-19-05 mitigation. Audit log PII exclusion matches T-19-04 mitigation.

## Self-Check: PASSED

All files verified present. All commits verified in git log.
