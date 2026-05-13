---
phase: 19-account-deletion-data-export
plan: "02"
subsystem: ui
tags: [react, tanstack-query, sonner, alert-dialog, account-settings, gdpr, data-export]

requires:
  - phase: 19-account-deletion-data-export
    provides: "requestMyAccountDeletion + cancelMyAccountDeletion + exportMyData API endpoints + SDK mutations"

provides:
  - "Account settings page with Export My Data card (downloads JSON file)"
  - "Account settings page with Delete Account card (request/cancel/countdown states)"
  - "AlertDialog confirmation for irreversible deletion action"

affects:
  - account-settings
  - dpa-compliance

tech-stack:
  added: []
  patterns:
    - "Lazy useQuery (enabled: false) + refetch() for on-demand data download"
    - "Person type cast with local extension type for fields not yet in TypeSpec"
    - "AlertDialog for confirmation of destructive actions"

key-files:
  created: []
  modified:
    - apps/account/src/routes/_dashboard/settings/account.tsx

key-decisions:
  - "Cast Person type with local PersonWithDeletion extension type since deletionRequestedAt/deletionScheduledAt exist in DB but not yet in TypeSpec-generated types"
  - "Use enabled:false + refetch() pattern for export query to avoid auto-fetching on mount"
  - "Explicit onSuccess/onError toast calls instead of meta.toast to ensure sonner (not shadcn) is used"

patterns-established:
  - "Lazy query pattern: useQuery({ ...opts, enabled: false }) then refetch() on user action"
  - "Browser download from JSON response: Blob + createObjectURL + anchor click + revokeObjectURL"

requirements-completed: [DPA-01, DPA-03]

duration: 15min
completed: 2026-05-13
---

# Phase 19 Plan 02: Account Deletion + Data Export UI Summary

**Self-service account deletion controls and JSON data export added to account settings page using AlertDialog confirmation, sonner toasts, and lazy query download pattern**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-13T22:50:00Z
- **Completed:** 2026-05-13T23:05:00Z
- **Tasks:** 1 of 1 auto tasks complete (checkpoint pending human verify)
- **Files modified:** 1

## Accomplishments
- Added Export My Data card with lazy useQuery + browser download (Blob/URL trick)
- Added Delete Account card with AlertDialog confirmation, 30-day grace period explanation
- Added pending deletion state: shows countdown in days + Cancel Deletion Request button
- All actions use sonner toasts (import { toast } from 'sonner'), not shadcn useToast
- TypeScript compiles clean

## Task Commits

1. **Task 1: Add deletion section + export button to account settings** - `b8cfb56` (feat)

## Files Created/Modified
- `apps/account/src/routes/_dashboard/settings/account.tsx` - Added Export My Data card, Delete Account card with AlertDialog, mutations for requestDeletion/cancelDeletion, lazy export query, daysRemaining calculation

## Decisions Made
- Person type doesn't expose `deletionRequestedAt`/`deletionScheduledAt` in TypeSpec yet (fields exist in DB schema). Created local `PersonWithDeletion` extension type and cast at usage point. This is the right trade-off: avoids changing TypeSpec just for frontend display, documents the gap clearly.
- Used explicit `onSuccess`/`onError` with `toast.success()`/`toast.error()` instead of `meta.toast` pattern to guarantee sonner usage regardless of whether the global mutation handler is wired.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Person type missing deletion fields**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan referenced `person.deletionRequestedAt` and `person.deletionScheduledAt` but Person type from TypeSpec does not include these fields (they exist in DB schema but TypeSpec hasn't been updated)
- **Fix:** Created local `PersonWithDeletion` type extension and cast `person` at usage points
- **Files modified:** apps/account/src/routes/_dashboard/settings/account.tsx
- **Verification:** `bunx tsc --noEmit` passes with 0 errors
- **Committed in:** b8cfb56

---

**Total deviations:** 1 auto-fixed (type gap between DB schema and TypeSpec)
**Impact on plan:** Minimal — workaround is clean and self-documenting. TypeSpec should be updated in a future plan to expose deletion fields on the Person response.

## Known Stubs
None - the UI wires directly to real SDK mutations. Deletion state comes from live person data.

## Issues Encountered
- Pre-commit hook ran in main worktree context, causing task commit to land on `feature/phase0-foundation` instead of worktree branch. Cherry-picked `cb89b92` onto `worktree-agent-a563723f` as `b8cfb56`.

## Threat Surface
- T-19-07 (Spoofing): Mitigated — mutations use session identity; AlertDialog prevents accidental clicks
- T-19-08 (Info Disclosure): Accepted — export returns authenticated user's own data only; no server-side storage

## Next Phase Readiness
- Human verification checkpoint pending (checkpoint:human-verify)
- After human approves: deletion UI complete for DPA-01 and DPA-03
- Remaining DPA gaps: TypeSpec update to expose deletion fields on Person type (DPA-05 candidate)

---
*Phase: 19-account-deletion-data-export*
*Completed: 2026-05-13*
