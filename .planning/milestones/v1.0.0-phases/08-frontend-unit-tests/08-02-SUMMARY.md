---
phase: 08-frontend-unit-tests
plan: "02"
subsystem: apps/memberry
tags: [testing, vitest, frontend, unit-tests, component-tests]
dependency_graph:
  requires: [08-01]
  provides: [component-unit-tests, dashboard-tests, dues-tests, member-table-tests]
  affects: [apps/memberry]
tech_stack:
  added: []
  patterns: [vi.mock-sdk-hooks, vi.mock-api, renderWithProviders, userEvent-interaction]
key_files:
  created:
    - apps/memberry/src/features/dashboard/components/member-dashboard.test.tsx
    - apps/memberry/src/features/dues/components/dues-invoice-list.test.tsx
    - apps/memberry/src/features/membership/components/member-table.test.tsx
  modified:
    - apps/memberry/vitest.config.ts
decisions:
  - "Add explicit resolve.alias @/ in vitest.config.ts — vite-tsconfig-paths plugin did not resolve @/ aliases in test files (tsconfig excludes *.test.tsx); explicit alias fixes this without removing the exclude"
  - "Use getAllByText for 'Active'/'Grace'/'Lapsed' in member-table tests — these strings appear in both tab labels and badge labels; getAllByText avoids false 'multiple elements' errors"
  - "StatusBadge renders capitalized labels (Active/Grace/Lapsed) not raw status values — tests updated to match component output"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  files_changed: 4
---

# Phase 08 Plan 02: Component Unit Tests Summary

**One-liner:** Component-level vitest tests for MemberDashboard, DuesInvoiceList, and MemberTable with vi.mock SDK hooks and api, covering 6+6+7=19 test cases across all render states.

## What Was Done

### Task 1: MemberDashboard and DuesInvoiceList component tests

**MemberDashboard** (`member-dashboard.test.tsx` — 6 tests):
- Empty state: api.get returns empty memberships → "No memberships yet" renders
- Loading state: never-resolving promise → component renders without crash during load
- Membership cards: 2 memberships (active + grace) → org names, capitalized StatusBadge labels, "Pay Dues" link for grace
- Events section: future-dated events → "Upcoming Events" heading + event titles
- Notifications: unread/read notifs → `font-semibold` for unread, `font-medium` for read
- No upcoming events: empty events array → "No upcoming events" text

Mocking strategy: `vi.mock('@/lib/api')` with per-path returns, `vi.mock('@tanstack/react-router')` with simple anchor replacement.

**DuesInvoiceList** (`dues-invoice-list.test.tsx` — 6 tests):
- Loading state: never-resolving queryFn → "Loading invoices..." visible
- Error state: rejected queryFn → "Failed to load invoices"
- Empty state: `{ data: [] }` → "No invoices yet."
- Invoice rows: 2 invoices → invoice numbers, formatCents(250000) = "₱2,500.00", status text
- Mark Paid presence: "sent" invoice has button, "paid" invoice does not
- Overdue invoices: "overdue" status also shows "Mark Paid" button

Mocking strategy: `vi.mock('@monobase/sdk-ts/generated/@tanstack/react-query.gen')` returning objects with queryKey/queryFn.

**Commit:** `1ebca88`

### Task 2: MemberTable component tests

**MemberTable** (`member-table.test.tsx` — 7 tests):
- Loading state: never-resolving query → no crash, loading skeleton DOM present
- Error state: rejected query → "Failed to load members"
- Empty state: `{ data: [] }` → "No members found"
- Member rows: 3 members (active/gracePeriod/lapsed) → names as links, license numbers, status badges (getAllByText since tabs have same labels)
- Status tabs: all 6 present (All, Active, Grace, Lapsed, Suspended, Pending)
- Search input: placeholder "Search by name, email or license..." present
- Bulk selection: `userEvent.click()` on first row checkbox → "1 selected" bar appears

Mocking strategy: `vi.mock('@monobase/sdk-ts/generated/react-query')` for listRosterMembersOptions + listMembershipCategoriesOptions, `vi.mock('@tanstack/react-router')` anchor replacement.

**Commit:** `d8d5ac1`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vite-tsconfig-paths failed to resolve @/ alias in test files**
- **Found during:** Task 1 verification
- **Issue:** `@/test/utils` import failed with "Does the file exist?" error. The root cause: `tsconfig.json` has `"exclude": ["**/*.test.tsx"]` which causes `vite-tsconfig-paths` to skip alias resolution for test files
- **Fix:** Added `resolve: { alias: { '@': resolve(__dirname, './src') } }` to the `mergeConfig` call in `vitest.config.ts` — this explicit alias overrides the failed plugin lookup
- **Files modified:** `apps/memberry/vitest.config.ts`
- **Commit:** `1ebca88`

**2. [Rule 1 - Bug] Test assertions used raw status values instead of StatusBadge labels**
- **Found during:** Task 1 verification (member-dashboard test)
- **Issue:** Tests checked for `'active'`, `'grace'` but StatusBadge renders `'Active'`, `'Grace'`
- **Fix:** Updated assertions to match component output
- **Files modified:** `member-dashboard.test.tsx`
- **Commit:** `1ebca88`

**3. [Rule 1 - Bug] getByText('Active') threw "multiple elements found" in MemberTable**
- **Found during:** Task 2 verification
- **Issue:** "Active" appears as both a TabsTrigger label and a status Badge label simultaneously
- **Fix:** Changed `getByText('Active')` to `getAllByText('Active').length >= 1`
- **Files modified:** `member-table.test.tsx`
- **Commit:** `d8d5ac1`

## Test Results

```
Test Files  10 passed (10)
     Tests  73 passed (73)
  Duration  1.41s
```

New component tests: 19 (6 MemberDashboard + 6 DuesInvoiceList + 7 MemberTable)
Pre-existing lib tests: 54 (all still passing)

## Known Stubs

None — test files only, no UI stubs.

## Threat Flags

None — test code only, no security surface.

## Self-Check: PASSED

- `apps/memberry/src/features/dashboard/components/member-dashboard.test.tsx` exists ✓
- `apps/memberry/src/features/dues/components/dues-invoice-list.test.tsx` exists ✓
- `apps/memberry/src/features/membership/components/member-table.test.tsx` exists ✓
- Commit `1ebca88` exists ✓
- Commit `d8d5ac1` exists ✓
- 10 test files, 73 tests pass under vitest ✓
- Each file has 5+ test cases ✓
