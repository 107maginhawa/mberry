---
phase: 25-email-notif-guards-handler-tests
plan: "01"
subsystem: email
tags: [email, suppression, rate-limiting, hmac, schema, tdd]
dependency_graph:
  requires: []
  provides:
    - email_suppression table + SuppressionRepository
    - emailCategory column on email_queue
    - generateUnsubToken / verifyUnsubToken (HMAC)
    - BulkRateLimiter (per-org sliding window)
  affects:
    - services/api-ts/src/handlers/email/repos/email.schema.ts
    - services/api-ts/src/generated/migrations/
tech_stack:
  added:
    - node:crypto (createHmac, timingSafeEqual) for HMAC token
  patterns:
    - TDD vertical slices (RED → GREEN → REFACTOR)
    - DatabaseRepository extension for org-scoped repo
    - In-memory Map sliding window for background job rate limiting
key_files:
  created:
    - services/api-ts/src/handlers/email/repos/suppression.schema.ts
    - services/api-ts/src/handlers/email/repos/suppression.repo.ts
    - services/api-ts/src/handlers/email/repos/suppression.repo.test.ts
    - services/api-ts/src/handlers/email/utils/unsub-token.ts
    - services/api-ts/src/handlers/email/utils/unsub-token.test.ts
    - services/api-ts/src/handlers/email/utils/bulk-rate-limiter.ts
    - services/api-ts/src/handlers/email/utils/bulk-rate-limiter.test.ts
    - services/api-ts/src/generated/migrations/0037_last_infant_terrible.sql
  modified:
    - services/api-ts/src/handlers/email/repos/email.schema.ts
decisions:
  - "Used DatabaseRepository.findManyWithPagination for listByOrg (not findMany which returns plain array)"
  - "BulkRateLimiter is standalone in-memory class, NOT HTTP middleware — safe for background job use"
  - "verifyUnsubToken uses timingSafeEqual for constant-time comparison (T-25-01 mitigation)"
  - "SuppressionRepository.addSuppression catches unique constraint violation (code 23505) and treats as no-op for idempotency"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  files_created: 8
  files_modified: 1
  tests_added: 19
---

# Phase 25 Plan 01: Email Guards Foundation Summary

**One-liner:** Org-scoped email_suppression schema + SuppressionRepository + HMAC unsub tokens + per-org BulkRateLimiter — all with 19 passing TDD tests.

## Tasks Completed

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | Schema extensions + suppression repository | 25e14cc (RED), c63247b (GREEN), 32e607c (REFACTOR) | suppression.schema.ts, suppression.repo.ts, email.schema.ts, migration 0037 |
| 2 | Unsubscribe token utils + bulk rate limiter | 7f797f9 (RED), 1d372c4 (GREEN) | unsub-token.ts, bulk-rate-limiter.ts |

## What Was Built

### Schema (email.schema.ts)
- Added `emailCategoryEnum` pgEnum with values `bulk | transactional`
- Added `emailCategory` column to `emailQueue` table (default: `transactional`)
- Added `emailCategory?: 'bulk' | 'transactional'` to `QueueEmailRequest` interface

### Suppression Schema (suppression.schema.ts)
- `email_suppression` table with org-scoped unique constraint on `(organization_id, email)`
- `suppressionReasonEnum`: hard_bounce | unsubscribe | complaint | manual
- Indexes: composite `(org, email)` + standalone `email`

### SuppressionRepository (suppression.repo.ts)
- `isSuppressed(email, orgId)` — org-scoped check (T-25-02 mitigated)
- `addSuppression({ orgId, email, reason, suppressedBy?, notes? })` — idempotent upsert
- `listByOrg(orgId, options?)` — paginated using `findManyWithPagination`
- `removeSuppression(orgId, email)` — direct delete

### Unsub Token (utils/unsub-token.ts)
- `generateUnsubToken(email, orgId)` — HMAC-SHA256, base64url output, uses `UNSUBSCRIBE_SECRET` env
- `verifyUnsubToken(token, email, orgId)` — constant-time comparison via `timingSafeEqual` (T-25-01 mitigated)

### BulkRateLimiter (utils/bulk-rate-limiter.ts)
- `class BulkRateLimiter { canSend(orgId): boolean }` — per-org sliding window
- Configurable via constructor or `BULK_EMAIL_RATE_LIMIT` env (default: 100/min)
- Prunes expired timestamps on each call (T-25-03 mitigated)

## Test Results

```
suppression.repo.test.ts:  7 pass, 0 fail
unsub-token.test.ts:       8 pass, 0 fail
bulk-rate-limiter.test.ts: 4 pass, 0 fail
Total: 19 pass, 0 fail
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] findMany returns array, not PaginatedResult**
- **Found during:** Task 1 — typecheck after initial GREEN commit
- **Issue:** `DatabaseRepository.findMany` returns `TEntity[]`, but `listByOrg` was returning it as `PaginatedResult`. Also `isSuppressed` was passing `{ offset, limit }` directly as `FindManyOptions` instead of `{ pagination: { offset, limit } }`.
- **Fix:** Changed `isSuppressed` to use `findMany` with `{ pagination: { offset: 0, limit: 1 } }`, changed `listByOrg` to use `findManyWithPagination`. Updated test mocks to match.
- **Files modified:** suppression.repo.ts, suppression.repo.test.ts
- **Commit:** 32e607c

## Threat Surface Scan

All threats in the plan's `<threat_model>` were mitigated:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-25-01 (token tampering) | `timingSafeEqual` in `verifyUnsubToken` |
| T-25-02 (cross-org leakage) | All queries include `organizationId` filter |
| T-25-03 (memory DoS) | BulkRateLimiter prunes expired entries per call; Map keyed by orgId |

No new threat surface introduced.

## Known Stubs

None — all modules are fully implemented and wired.

## Self-Check: PASSED

- suppression.schema.ts: EXISTS
- suppression.repo.ts: EXISTS
- suppression.repo.test.ts: EXISTS (7 tests pass)
- unsub-token.ts: EXISTS
- unsub-token.test.ts: EXISTS (8 tests pass)
- bulk-rate-limiter.ts: EXISTS
- bulk-rate-limiter.test.ts: EXISTS (4 tests pass)
- Migration 0037: EXISTS at services/api-ts/src/generated/migrations/0037_last_infant_terrible.sql
- Commits: 25e14cc, c63247b, 32e607c, 7f797f9, 1d372c4 all in git log
