---
phase: 25-email-notif-guards-handler-tests
plan: "02"
subsystem: email
tags: [email, guards, suppression, rate-limit, unsubscribe, tdd]
dependency_graph:
  requires: [25-01]
  provides: [email-guard-pipeline, unsubscribe-headers]
  affects: [services/api-ts/src/core/email.ts]
tech_stack:
  added: []
  patterns: [guard-chain, tdd-red-green, rfc-8058-unsubscribe]
key_files:
  created:
    - services/api-ts/src/core/email.test.ts
  modified:
    - services/api-ts/src/core/email.ts
    - services/api-ts/src/handlers/email/repos/email.schema.ts
decisions:
  - "Guards fire before template resolution to avoid unnecessary DB work on blocked emails"
  - "Bulk rate-limited emails reschedule (status=pending) rather than fail — prevents data loss"
  - "Deceased guard skips when metadata.recipientPersonId absent — backwards-compatible"
  - "Unsubscribe headers generated inside sendEmail via unsubscribeContext field on SendEmailRequest"
  - "MembershipRepository accessed from association:member handlers — no duplication"
metrics:
  duration: "~25 min"
  completed: "2026-05-13"
  tasks_completed: 1
  files_changed: 3
---

# Phase 25 Plan 02: Processor Guards Summary

Wire four email guards into the processEmail pipeline and inject RFC 8058 unsubscribe headers on every outbound email.

## What Was Built

**Guard chain in `EmailServiceImpl.processEmail`** (fires before template resolution):

1. **Suppression guard** — calls `suppressionRepo.isSuppressed(email, orgId)`, marks email `failed` with reason "Recipient is suppressed", logs for audit trail (T-25-04)
2. **Deceased/departed guard** — checks `metadata.recipientPersonId`; if present, calls `membershipRepo.findByPersonAndOrg()` and blocks statuses: `deceased`, `resigned`, `expelled`, `lapsed`. Marks `failed` with reason. Skips guard when personId absent (backwards-compatible).
3. **Bulk rate limit guard** — only for `emailCategory === 'bulk'`. Calls `bulkRateLimiter.canSend(orgId)`. On limit exceeded: reschedules 60s forward with `status=pending` via `updateOneById` (T-25-05). Transactional emails bypass entirely.
4. **Unsubscribe header injection** — `sendEmail` receives `unsubscribeContext: { email, orgId }` from `processEmail`. Generates HMAC token via `generateUnsubToken`, constructs RFC 8058 URL, injects `List-Unsubscribe` and `List-Unsubscribe-Post` headers on every outbound email (T-25-06).

**Schema extension:** Added `headers?: Record<string, string>` and `unsubscribeContext?: { email, orgId }` to `SendEmailRequest` interface.

## TDD Gate Compliance

- RED commit: `fe9965c` — 14 failing tests covering all 4 guard scenarios
- GREEN commit: `834b436` — 20 tests passing (14 new + 6 existing processor tests)
- REFACTOR: `374094c` — TS4111 bracket notation fix (auto-fixed, Rule 1)

## Tests

- 14 new tests in `src/core/email.test.ts`
- 6 existing tests in `src/handlers/email/jobs/processor.test.ts` — all still pass
- Total: 20 tests, 0 failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS4111 index signature access**
- **Found during:** Pre-commit hook after GREEN commit
- **Issue:** `email.metadata.recipientPersonId` triggered TS4111 (`noPropertyAccessFromIndexSignature`)
- **Fix:** Changed to bracket notation `email.metadata?.['recipientPersonId']`
- **Files modified:** `services/api-ts/src/core/email.ts`
- **Commit:** `374094c`

### Out of Scope (pre-existing)

Pre-existing TS errors in `registry.ts` (duplicate `listFeatureFlags`), `membership/repos/membership.repo.ts`, system handlers, and memberry app are unrelated to this plan and were not touched. Logged to deferred items.

## Threat Surface Scan

No new network endpoints or trust boundary changes introduced. Guards only affect internal email processing pipeline. Unsubscribe URL uses HMAC token — accepted risk per T-25-06 (email already in recipient's inbox).

## Self-Check: PASSED

- `services/api-ts/src/core/email.test.ts` — EXISTS
- `services/api-ts/src/core/email.ts` — modified with guard chain
- `services/api-ts/src/handlers/email/repos/email.schema.ts` — modified with headers/unsubscribeContext
- Commits `fe9965c`, `834b436`, `374094c` — all present in git log
