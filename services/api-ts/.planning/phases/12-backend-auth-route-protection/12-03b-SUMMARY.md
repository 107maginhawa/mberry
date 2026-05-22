---
phase: 12-backend-auth-route-protection
plan: "03b"
subsystem: backend-auth
tags: [authorization, officer-check, events, training, courses]
dependency_graph:
  requires:
    - 12-03 (requireOfficerTerm utility)
  provides:
    - Officer-protected event mutation endpoints
    - Officer-protected training mutation endpoints
    - Officer-protected course mutation endpoints
  affects:
    - services/api-ts/src/handlers/association:operations/
tech_stack:
  added: []
  patterns:
    - Handler-level requireOfficerTerm guard pattern
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:operations/createEvent.ts
    - services/api-ts/src/handlers/association:operations/updateEvent.ts
    - services/api-ts/src/handlers/association:operations/deleteEvent.ts
    - services/api-ts/src/handlers/association:operations/cancelEvent.ts
    - services/api-ts/src/handlers/association:operations/publishEvent.ts
    - services/api-ts/src/handlers/association:operations/createCheckIn.ts
    - services/api-ts/src/handlers/association:operations/createTraining.ts
    - services/api-ts/src/handlers/association:operations/updateTraining.ts
    - services/api-ts/src/handlers/association:operations/deleteTraining.ts
    - services/api-ts/src/handlers/association:operations/publishTraining.ts
    - services/api-ts/src/handlers/association:operations/createCourse.ts
    - services/api-ts/src/handlers/association:operations/updateCourse.ts
    - services/api-ts/src/handlers/association:operations/deleteCourse.ts
decisions:
  - "requireOfficerTerm placed after user/orgId null checks to avoid unnecessary DB queries on unauthenticated requests"
  - "No changes to GET/search/list handlers — members retain read access per D-07"
  - "No changes to existing requireOrgRole() calls per D-09"
metrics:
  duration: "~20 minutes (includes bun install worktree fix)"
  completed: "2026-05-08"
  tasks_completed: 2
  files_modified: 13
---

# Phase 12 Plan 03b: Officer Guard — association:operations Mutation Handlers Summary

**One-liner:** Added `requireOfficerTerm` guard to all 13 association:operations mutation handlers, closing the authorization gap on event, training, and course mutations.

## What Was Built

Applied the `requireOfficerTerm` utility (created in Plan 03) to all mutation handlers in `services/api-ts/src/handlers/association:operations/`. Members now receive 403 on all create/update/delete operations while GET/search/list handlers remain accessible.

### Handler Coverage

**Event handlers (6):**
- `createEvent` — POST /association/events
- `updateEvent` — PATCH /association/events/{eventId}
- `deleteEvent` — DELETE /association/events/{eventId}
- `cancelEvent` — POST /association/events/{eventId}/cancel
- `publishEvent` — POST /association/events/{eventId}/publish
- `createCheckIn` — POST /association/events/checkins

**Training/course handlers (7):**
- `createTraining` — POST /association/training
- `updateTraining` — PATCH /association/training/{trainingId}
- `deleteTraining` — DELETE /association/training/{trainingId}
- `publishTraining` — POST /association/training/{trainingId}/publish
- `createCourse` — POST /association/training/courses
- `updateCourse` — PATCH /association/training/courses/{courseId}
- `deleteCourse` — DELETE /association/training/courses/{courseId}

### Guard Pattern Applied

```typescript
import { requireOfficerTerm } from '@/utils/officer-check';

export async function createEvent(ctx: ValidatedContext<...>) {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  // ... existing handler logic unchanged
}
```

Guard is placed after user/orgId null checks (avoids unnecessary DB query on unauthenticated requests) but before all business logic.

## Verification

- `grep -rl 'requireOfficerTerm' services/api-ts/src/handlers/association:operations/ | wc -l` = 13
- No GET/search/list handlers contain `requireOfficerTerm` (verified: 0 matches)
- No existing `requireOrgRole()` calls were modified

## Commits

- `09d25c6` feat(12-03b): add requireOfficerTerm guard to event and check-in handlers
- `da741fa` feat(12-03b): add requireOfficerTerm guard to training and course handlers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree bun install incomplete**
- **Found during:** Task 1 commit attempt
- **Issue:** The git worktree had an incomplete `bun install` (esbuild postinstall failed), causing missing `@typescript-eslint/scope-manager` and related packages that broke the pre-commit eslint hook.
- **Fix:** Ran `BUN_IGNORE_POSTINSTALL=1 bun install` to skip the esbuild postinstall and complete the package install. Additionally linked `@monobase/api-spec/dist` from the main repo since it wasn't built in the worktree context.
- **Files modified:** None (node_modules only, not tracked)
- **Commit:** N/A (infra fix, no code commit)

## Known Stubs

None — the `requireOfficerTerm` call is wired to a real DB query against `officer_term` table.

## Threat Surface Scan

No new network endpoints introduced. All changes are guard additions to existing mutation handlers. Threats T-12-08 and T-12-09 from the plan's threat model are now mitigated.

## Self-Check: PASSED

- All 13 handler files confirmed modified with `requireOfficerTerm`
- Commits 09d25c6 and da741fa exist in git log
- GET/search/list handlers confirmed unmodified (0 grep matches)
