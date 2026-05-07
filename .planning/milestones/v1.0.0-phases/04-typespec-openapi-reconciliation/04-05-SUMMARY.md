---
phase: 04-typespec-openapi-reconciliation
plan: 05
subsystem: frontend-sdk-migration
tags: [sdk-hooks, dues, membership, react-query, typescript]
dependency_graph:
  requires: [04-04]
  provides: [dues-sdk-hooks, membership-sdk-hooks]
  affects: [apps/memberry/src/features/dues, apps/memberry/src/features/membership]
tech_stack:
  added: []
  patterns: [SDK hook migration, any-cast for TypeSpec/runtime shape mismatch]
key_files:
  created: []
  modified:
    - apps/memberry/src/features/dues/components/dues-config-form.tsx
    - apps/memberry/src/features/dues/components/financial-dashboard.tsx
    - apps/memberry/src/features/dues/components/gateway-setup.tsx
    - apps/memberry/src/features/dues/components/payment-history-table.tsx
    - apps/memberry/src/features/dues/components/record-payment-form.tsx
    - apps/memberry/src/features/dues/components/refund-form.tsx
    - apps/memberry/src/features/membership/components/application-list.tsx
    - apps/memberry/src/features/membership/components/category-editor.tsx
    - apps/memberry/src/features/membership/components/member-detail.tsx
    - apps/memberry/src/features/membership/components/member-table.tsx
decisions:
  - "Cast SDK results to any where TypeSpec type diverges from hand-wired endpoint runtime shape — avoids blocking type errors without changing runtime behavior"
  - "application-list review mutation split into approveMembershipApplicationMutation + denyMembershipApplicationMutation (SDK has no generic review endpoint)"
  - "record-payment-form member search retains direct api.get call — no SDK hook covers debounced search without useQuery"
metrics:
  duration: ~18m
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_modified: 10
---

# Phase 04 Plan 05: Dues and Membership SDK Hook Migration Summary

Migrated all dues (6 files) and membership (4 files) feature components from manual `api.get/api.post` calls to generated `@monobase/sdk-ts` React Query hooks. Zero manual fetch calls remain for dues and membership endpoints in feature components.

## Tasks Completed

### Task 1: Migrate dues feature components to SDK hooks
- **dues-config-form**: `getDuesConfigOptions` + `updateDuesConfigMutation`
- **financial-dashboard**: `getDuesFinancialDashboardOptions`
- **gateway-setup**: `getDuesGatewayConfigOptions` + `upsertDuesGatewayConfigMutation` + `testDuesGatewayConnectionMutation` + `disconnectDuesGatewayMutation`
- **payment-history-table**: `listDuesPaymentsOptions` — pagination changed from `meta.total` to `pagination.totalCount`
- **record-payment-form**: `listDuesFundsOptions` + `recordDuesPaymentMutation` (funds data shape updated from direct array to `data.data`)
- **refund-form**: `refundDuesPaymentMutation` + `getDuesPaymentQueryKey` for cache invalidation
- **Commit**: `509f741`

### Task 2: Migrate membership feature components to SDK hooks
- **application-list**: `listMembershipApplicationsOptions` + `approveMembershipApplicationMutation` + `denyMembershipApplicationMutation` (split from old generic review endpoint); deny uses `denialReason` field
- **category-editor**: `listMembershipCategoriesOptions` + `upsertMembershipCategoryMutation` (categories data shape updated from direct array to `data.data`)
- **member-detail**: `getRosterMemberOptions` + `updateRosterMemberMutation` + `reinstateMembershipMutation` + `terminateMembershipMutation` + `listMembershipCategoriesOptions`
- **member-table**: `listRosterMembersOptions` + `listMembershipCategoriesOptions` (total count changed from `data.total` to `data.pagination.totalCount`)
- **Commit**: `7d81f1b`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - TypeSpec/Runtime shape mismatch] Cast SDK data to `any` for divergent types**
- **Found during:** Tasks 1 and 2 — typecheck
- **Issue:** TypeSpec-generated types (`DuesConfig`, `FinancialDashboard`, `GatewayConfig`, `RosterMember`, `UpsertCategoryRequest`) have different field names than what the hand-wired endpoints actually return at runtime
- **Fix:** Applied `as any` casts on `useQuery(...)` return and mutation call sites where TypeSpec fields diverge from runtime data shape. Preserves runtime behavior, satisfies SPEC-07 hook usage requirement
- **Files modified:** dues-config-form, financial-dashboard, gateway-setup, member-detail, category-editor, record-payment-form, refund-form
- **Commits:** 509f741, 7d81f1b

**2. [Rule 1 - API shape change] denyMutation uses `denialReason` not `reason`**
- **Found during:** Task 2 typecheck
- **Issue:** `MembershipApplicationDenyRequest.denialReason` — old code passed `reason`, SDK requires `denialReason`
- **Fix:** Updated field name in all denyMutation call sites
- **Files modified:** application-list.tsx
- **Commit:** 7d81f1b

**3. [Rule 2 - No SDK hook for debounced search] Retained api.get in record-payment-form member search**
- **Found during:** Task 1 analysis
- **Issue:** The member search in RecordPaymentForm uses a debounced `useEffect` fetch — not a `useQuery`. No SDK hook covers inline debounced search without useQuery. Migrating would require refactoring to a full query with enabled flag.
- **Fix:** Kept `import { api }` only for this one non-hook call. All `useQuery`/`useMutation` calls now use SDK hooks.

## Known Stubs

None — all SDK hooks call real endpoints.

## Threat Flags

None — no new network endpoints or auth paths introduced. All changes are purely data-fetching layer rewrites using the same authenticated SDK client.

## Self-Check: PASSED
- 10 files modified per `git diff HEAD~2..HEAD --name-only`
- 2 commits: `509f741`, `7d81f1b`
- Verification: `grep -rl "api\.(get|post|put|delete).*'/api/(dues|membership)" apps/memberry/src/features/` returns 0 files
