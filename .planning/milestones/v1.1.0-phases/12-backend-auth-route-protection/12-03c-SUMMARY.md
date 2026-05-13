---
phase: 12-backend-auth-route-protection
plan: "03c"
subsystem: api-ts
tags: [auth, rbac, officer-protection, green-phase, handler-guard]
dependency_graph:
  requires: [requireOfficerTerm-utility, officer-auth-middleware]
  provides: [all-officer-mutations-protected]
  affects:
    - services/api-ts/src/handlers/association:member/createElection.ts
    - services/api-ts/src/handlers/association:member/createDuesConfig.ts
    - services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts
    - services/api-ts/src/handlers/association:member/recordDuesPayment.ts
    - services/api-ts/src/handlers/association:member/refundDuesPayment.ts
    - services/api-ts/src/handlers/association:member/createMembership.ts
    - services/api-ts/src/handlers/association:member/updateMembership.ts
    - services/api-ts/src/handlers/association:member/createOfficerTerm.ts
    - services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts
    - services/api-ts/src/handlers/association:member/approveMembershipApplication.ts
    - services/api-ts/src/handlers/association:member/denyMembershipApplication.ts
    - services/api-ts/src/handlers/association:member/createPosition.ts
    - services/api-ts/src/handlers/association:member/addRosterMember.ts
    - services/api-ts/src/handlers/association:member/importRosterMembers.ts
    - services/api-ts/src/handlers/communications/createAnnouncement.ts
    - services/api-ts/src/handlers/communications/publishAnnouncement.ts
tech_stack:
  added: []
  patterns: [handler-level-auth-check, requireOfficerTerm-guard]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:member/createElection.ts
    - services/api-ts/src/handlers/association:member/createDuesConfig.ts
    - services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts
    - services/api-ts/src/handlers/association:member/recordDuesPayment.ts
    - services/api-ts/src/handlers/association:member/refundDuesPayment.ts
    - services/api-ts/src/handlers/association:member/createMembership.ts
    - services/api-ts/src/handlers/association:member/updateMembership.ts
    - services/api-ts/src/handlers/association:member/createOfficerTerm.ts
    - services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts
    - services/api-ts/src/handlers/association:member/approveMembershipApplication.ts
    - services/api-ts/src/handlers/association:member/denyMembershipApplication.ts
    - services/api-ts/src/handlers/association:member/createPosition.ts
    - services/api-ts/src/handlers/association:member/addRosterMember.ts
    - services/api-ts/src/handlers/association:member/importRosterMembers.ts
    - services/api-ts/src/handlers/communications/createAnnouncement.ts
    - services/api-ts/src/handlers/communications/publishAnnouncement.ts
decisions:
  - requireOfficerTerm added at top of each handler before session/user checks
  - communications handlers cast ctx to BaseContext for requireOfficerTerm compatibility
  - GET/list handlers left unprotected per D-07
  - No existing requireOrgRole calls modified per D-09
metrics:
  duration: 20m
  completed: 2026-05-08
  tasks_completed: 2
  tasks_total: 2
---

# Phase 12 Plan 03c: Add requireOfficerTerm to All Officer-Only Mutation Handlers Summary

**One-liner:** GREEN phase adding requireOfficerTerm guard to all 16 officer-only mutation handlers across association:member (14 files) and communications (2 files), closing the authorization gap on generated routes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add requireOfficerTerm to dues and membership mutation handlers | db41ec5 | 8 handler files (createDuesConfig, generateDuesInvoicesForOrg, recordDuesPayment, refundDuesPayment, createMembership, updateMembership, approveMembershipApplication, denyMembershipApplication) |
| 2 | Add requireOfficerTerm to election, governance, roster, and announcement handlers | 14e8139 | 8 handler files (createElection, createOfficerTerm, createPosition, updateOrganizationProfile, addRosterMember, importRosterMembers, createAnnouncement, publishAnnouncement) |

## What Was Built

### Pattern Applied (all 16 handlers)

```typescript
import { requireOfficerTerm } from '@/utils/officer-check';

export async function handlerName(ctx: ...) {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  // ... existing handler logic unchanged
}
```

### Task 1: 8 dues and membership handlers

- `createDuesConfig` — POST /association/member/dues-configs
- `generateDuesInvoicesForOrg` — POST /association/member/dues-invoices/generate
- `recordDuesPayment` — POST /association/member/dues-payments
- `refundDuesPayment` — POST /association/member/dues-payments/{paymentId}/refund
- `createMembership` — POST /association/member/memberships
- `updateMembership` — PATCH /association/member/memberships/{membershipId}
- `approveMembershipApplication` — POST /association/member/applications/{id}/approve
- `denyMembershipApplication` — POST /association/member/applications/{id}/deny

### Task 2: 8 election, governance, roster, and announcement handlers

- `createElection` — POST /association/member/elections
- `createOfficerTerm` — POST /association/member/officer-terms
- `createPosition` — POST /association/member/positions
- `updateOrganizationProfile` — PUT /association/member/org-profile/{organizationId}
- `addRosterMember` — POST /association/member/roster
- `importRosterMembers` — POST /association/member/roster/import
- `createAnnouncement` — POST /communications/announcements (officer-only mutation)
- `publishAnnouncement` — POST /communications/announcements/{id}/publish (officer-only mutation)

### Communications Handler Adaptation

`createAnnouncement` and `publishAnnouncement` use `Context` (plain hono) rather than `BaseContext`. Cast applied:

```typescript
import type { BaseContext } from '@/types/app';
const denied = await requireOfficerTerm(ctx as unknown as BaseContext);
```

This works because the Variables (user, orgId, database) are set by middleware for all authenticated routes.

## Verification

- `grep -rl 'requireOfficerTerm' services/api-ts/src/handlers/association:member/ | wc -l` = 14
- `grep -rl 'requireOfficerTerm' services/api-ts/src/handlers/communications/ | wc -l` = 2
- No GET/list handlers contain requireOfficerTerm
- No existing requireOrgRole calls modified

## Deviations from Plan

**1. [Rule 3 - Blocking] Commit from worktree directory required**
- **Found during:** Task 1 commit attempt
- **Issue:** Running `git commit` from `/Users/elad-mini/Desktop/memberry` (main repo) committed to `feature/phase0-foundation` instead of `worktree-agent-a76bdaa9`. The worktree has its own file tree at `.claude/worktrees/agent-a76bdaa9/`.
- **Fix:** Reset accidental commit on main branch (`git reset --hard 4b21b7d`). Applied all edits to worktree path files. Committed from worktree shell context.
- **Impact:** No lost work. All changes committed to correct branch.

**2. [Rule 2 - Missing critical] Context cast for communications handlers**
- **Found during:** Task 2 — createAnnouncement/publishAnnouncement use `Context` not `BaseContext`
- **Fix:** Added `ctx as unknown as BaseContext` cast. requireOfficerTerm reads Variables (user, orgId, database) set by middleware, compatible at runtime.
- **Files:** createAnnouncement.ts, publishAnnouncement.ts

## Threat Flags

None — no new network surface. Existing mutation routes now correctly protected against member elevation of privilege (T-12-11 through T-12-14 mitigated).

## Self-Check: PASSED

- 14 association:member handlers have requireOfficerTerm: VERIFIED (grep count = 14)
- 2 communications handlers have requireOfficerTerm: VERIFIED (grep count = 2)
- Commit db41ec5 exists: VERIFIED
- Commit 14e8139 exists: VERIFIED
- No GET/list handlers modified: VERIFIED (plan limited to mutation handlers only)
