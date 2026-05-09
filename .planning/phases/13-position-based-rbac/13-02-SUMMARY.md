---
phase: 13-position-based-rbac
plan: "02"
subsystem: backend-rbac
tags: [rbac, position-based-access, officer-check, association-member, communications]
dependency_graph:
  requires: ["13-01"]
  provides: ["position-restricted-member-handlers", "position-restricted-comms-handlers"]
  affects: ["services/api-ts/src/handlers/association:member/", "services/api-ts/src/handlers/communications/"]
tech_stack:
  added: []
  patterns: ["requirePosition guard call", "POSITION_TITLES constants"]
key_files:
  created: []
  modified:
    - services/api-ts/src/handlers/association:member/recordDuesPayment.ts
    - services/api-ts/src/handlers/association:member/refundDuesPayment.ts
    - services/api-ts/src/handlers/association:member/createDuesConfig.ts
    - services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts
    - services/api-ts/src/handlers/association:member/addRosterMember.ts
    - services/api-ts/src/handlers/association:member/importRosterMembers.ts
    - services/api-ts/src/handlers/association:member/approveMembershipApplication.ts
    - services/api-ts/src/handlers/association:member/denyMembershipApplication.ts
    - services/api-ts/src/handlers/association:member/createMembership.ts
    - services/api-ts/src/handlers/association:member/updateMembership.ts
    - services/api-ts/src/handlers/communications/createAnnouncement.ts
    - services/api-ts/src/handlers/communications/publishAnnouncement.ts
    - services/api-ts/src/handlers/association:member/createElection.ts
    - services/api-ts/src/handlers/association:member/createOfficerTerm.ts
    - services/api-ts/src/handlers/association:member/createPosition.ts
    - services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts
decisions:
  - "Treasurer+President for dues handlers (D-01 matrix)"
  - "Secretary+President for roster, membership, and announcement handlers (D-01 matrix)"
  - "President-only for governance handlers: elections, officer-terms, positions, org-profile (D-01 matrix)"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-05-08"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 16
---

# Phase 13 Plan 02: Wire requirePosition to Member + Communications Handlers Summary

Replaced `requireOfficerTerm` with position-specific `requirePosition(ctx, [...titles])` across all 16 association:member and communications handler files, enforcing Treasurer/Secretary/President domain separation per D-01 matrix.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire requirePosition to Treasurer + Secretary + communications handlers | 2b6ff72 | 12 files |
| 2 | Wire requirePosition to President-only governance handlers | 167ce39 | 4 files |

## What Changed

**Treasurer + President (4 files — dues domain):**
- `recordDuesPayment.ts`, `refundDuesPayment.ts`, `createDuesConfig.ts`, `generateDuesInvoicesForOrg.ts`
- Guard: `requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT])`

**Secretary + President (6 files — roster/membership domain):**
- `addRosterMember.ts`, `importRosterMembers.ts`, `approveMembershipApplication.ts`, `denyMembershipApplication.ts`, `createMembership.ts`, `updateMembership.ts`
- Guard: `requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT])`

**Secretary + President (2 files — communications domain):**
- `createAnnouncement.ts`, `publishAnnouncement.ts`
- Guard: `requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT])`

**President only (4 files — governance domain):**
- `createElection.ts`, `createOfficerTerm.ts`, `createPosition.ts`, `updateOrganizationProfile.ts`
- Guard: `requirePosition(ctx, [POSITION_TITLES.PRESIDENT])`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree node_modules not installed**
- **Found during:** Task 2 commit
- **Issue:** Pre-commit hook failed — worktree has no node_modules, `tsc` not found, eslint `@monobase/eslint-config` unresolvable
- **Fix:** Symlinked main repo's `node_modules` and `services/api-ts/node_modules` to worktree directories
- **Files modified:** None (symlinks only, not tracked)
- **Commit:** N/A (infrastructure fix)

**2. [Rule 3 - Blocking] Task 1 commit accidentally on feature/phase0-foundation**
- **Found during:** Task 1 commit
- **Issue:** Shell cwd resolved to main repo dir for all `cd /Users/elad-mini/Desktop/memberry/` commands; git staged and committed on main repo's branch
- **Fix:** Cherry-picked the Task 1 commit onto `worktree-agent-a16c7230` branch
- **Commit:** 2b6ff72 (cherry-pick of d022b35)

## Verification

```
grep -rl "requireOfficerTerm" association:member/ communications/ → 0 files
grep -rl "requirePosition"    association:member/ communications/ → 16 files
grep -c "POSITION_TITLES.PRESIDENT\])" createElection.ts → 1
```

All acceptance criteria met.

## Known Stubs

None — changes are pure guard-call replacements, no data logic touched.

## Threat Flags

No new threat surface introduced. This plan mitigates T-13-04 and T-13-05 from the plan's threat register by replacing binary officer checks with position-specific title arrays.

## Self-Check: PASSED

- Task 1 commit 2b6ff72 exists on worktree branch
- Task 2 commit 167ce39 exists on worktree branch
- 0 files with requireOfficerTerm in member/communications handlers
- 16 files with requirePosition in member/communications handlers
