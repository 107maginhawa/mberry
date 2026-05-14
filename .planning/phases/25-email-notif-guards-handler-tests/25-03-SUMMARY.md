---
phase: 25-email-notif-guards-handler-tests
plan: "03"
subsystem: email
tags: [email, unsubscribe, suppression, rfc8058, tdd]
dependency_graph:
  requires: [25-01]
  provides: [unsubscribe-endpoint, suppression-list-endpoint]
  affects: [app.ts, email-handler-module]
tech_stack:
  added: []
  patterns: [hono-context-handler, stub-repo-tdd, public-before-auth-middleware]
key_files:
  created:
    - services/api-ts/src/handlers/email/unsubscribeEmail.ts
    - services/api-ts/src/handlers/email/unsubscribeEmail.test.ts
    - services/api-ts/src/handlers/email/listEmailSuppressions.ts
    - services/api-ts/src/handlers/email/listEmailSuppressions.test.ts
  modified:
    - services/api-ts/src/app.ts
decisions:
  - "Public unsubscribe routes registered before /email/* wildcard auth middleware to avoid auth interception"
  - "unsubscribeEmail returns HTML (text/html) not JSON — per RFC 8058 (mail client clicks)"
  - "listEmailSuppressions returns 401 directly (not throw) for null user to avoid error-handler wrapping"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 25 Plan 03: Unsubscribe Endpoint + List Suppressions Summary

RFC 8058 one-click unsubscribe (public, HMAC-verified) and officer suppression list query (admin-only, org-scoped) — both consuming SuppressionRepository from Plan 01.

## Tasks Completed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 | RFC 8058 unsubscribe endpoint | c6c0865 (RED), 429e6f7 (GREEN) | 6 pass |
| 2 | Officer suppression list endpoint | ae94b93 (RED), f121287 (GREEN) | 4 pass |

**Total: 10/10 tests pass**

## What Was Built

### unsubscribeEmail.ts
- Accepts query params: `token`, `email`, `orgId`
- Validates all three params (400 if any missing)
- HMAC-SHA256 token verification via `verifyUnsubToken` (T-25-07 mitigation)
- Calls `suppressionRepo.addSuppression({ orgId, email, reason: 'unsubscribe' })` (idempotent)
- Returns HTML confirmation (200) or HTML error (400) — not JSON
- Registered as `GET /email/unsubscribe` and `POST /email/unsubscribe` BEFORE auth middleware

### listEmailSuppressions.ts
- Requires authenticated user (401 if null)
- Requires admin role (403 via ForbiddenError)
- Org-scoped via `organizationId` from context (T-25-09 mitigation)
- Calls `suppressionRepo.listByOrg(orgId, pagination)`
- Registered as `GET /email/suppressions` after auth middleware

### app.ts changes
- Imported `unsubscribeEmail` and `listEmailSuppressions`
- Public routes (GET+POST `/email/unsubscribe`) before `app.use('/email/*', authMiddleware())`
- Protected route (`GET /email/suppressions`) after the auth middleware block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dead code causing typecheck warning in listEmailSuppressions.ts**
- **Found during:** Task 2 GREEN commit
- **Issue:** `const query = c.req.query ? undefined : undefined;` was flagged as TS2774 (always-true condition)
- **Fix:** Removed dead line, removed unused `UnauthorizedError` import
- **Files modified:** `listEmailSuppressions.ts`
- **Commit:** Folded into f121287

### Pre-existing Issues (out of scope, not fixed)
- `@monobase/api-spec/openapi.json` not found (pre-existing)
- `generated/openapi/registry.ts` duplicate identifiers (pre-existing)
- `membership.repo.ts` property error (pre-existing)
- `apps/memberry` route type errors (pre-existing)

All pre-existing typecheck errors exist on the branch before this plan and are out of scope.

## Threat Model Coverage

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-25-07 Tampering (unsubscribe) | HMAC-SHA256 via verifyUnsubToken before any DB write | Implemented |
| T-25-08 DoS (unsubscribe) | Accepted — simple verify+write, no expensive ops | N/A |
| T-25-09 Elevation of Privilege (suppressions) | Admin role check + org-scoped query | Implemented |
| T-25-10 Spoofing (token) | HMAC(email+orgId) — not enumerable without server secret | Implemented |

## Self-Check: PASSED

- [x] `services/api-ts/src/handlers/email/unsubscribeEmail.ts` — exists
- [x] `services/api-ts/src/handlers/email/unsubscribeEmail.test.ts` — exists
- [x] `services/api-ts/src/handlers/email/listEmailSuppressions.ts` — exists
- [x] `services/api-ts/src/handlers/email/listEmailSuppressions.test.ts` — exists
- [x] Commits c6c0865, 429e6f7, ae94b93, f121287 — verified in git log
- [x] All 10 tests pass
