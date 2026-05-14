---
phase: 21-officer-daily-ops
plan: "03"
subsystem: association:member
tags: [bulk-approve, membership, officer, partial-success, org-scope]
dependency_graph:
  requires: [21-01]
  provides: [bulk-approve-handler, OPS-02, OPS-03]
  affects: [membership-applications, memberships]
tech_stack:
  added: []
  patterns: [per-record-transaction, partial-success-response, org-scope-validation]
key_files:
  created:
    - services/api-ts/src/handlers/association:member/bulkApproveMembershipApplications.ts
    - services/api-ts/src/handlers/association:member/bulkApproveMembershipApplications.test.ts
  modified: []
decisions:
  - "Per-record db.transaction (not all-or-nothing) enables partial success without blocking good records on one failure"
  - "Officer orgId sourced from ctx.get('organizationId') set by orgContextMiddleware — same pattern as requirePosition"
  - "auditAction called once after loop with summary count rather than per-record to avoid audit log flooding"
  - "Audit action uses 'approve' (existing union type) with bulk summary in description rather than adding new type"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-13"
  tasks_completed: 1
  files_created: 2
---

# Phase 21 Plan 03: Bulk Approve Membership Applications Summary

Bulk approve handler with per-record org scope validation and partial-success response semantics.

## What Was Built

`bulkApproveMembershipApplications` handler implementing OPS-02 (bulk approval) and OPS-03 (cross-org rejection):

- Officers (Secretary/President) submit `{ applicationIds: string[] }`
- Each application processed independently: fetch → scope check → status check → transaction
- Per-record `db.transaction`: approve + create membership atomically per item
- Cross-org applications rejected with "Organization scope violation" reason (T-21-05 mitigated)
- Response: `{ succeeded: string[], failed: { id, reason }[] }`
- Single audit log entry summarizing outcome

## TDD Gate Compliance

- RED commit: `9e53a62` — 8 failing tests
- GREEN commit: `68fe5fd` — 8 passing tests
- FIX commit: `935a22e` — audit action type correction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Audit action type mismatch**
- **Found during:** Task 1 (commit hook typecheck)
- **Issue:** `'bulk-approve'` not in `AuditActionOpts` action union type
- **Fix:** Changed to `'approve'` with descriptive bulk summary in `description` field
- **Files modified:** `bulkApproveMembershipApplications.ts`
- **Commit:** `935a22e`

### Pre-existing Out-of-Scope Typecheck Errors
The following pre-existing errors in `registry.ts` and `system/` handlers appeared in typecheck output but are NOT caused by this plan and were not touched:
- `src/generated/openapi/registry.ts` — duplicate `listFeatureFlags` identifier
- `src/handlers/system/*.ts` — missing `db` export from `@/core/database`

These are logged to deferred items and excluded from this plan's scope.

## Threat Model Coverage

| Threat | Status |
|--------|--------|
| T-21-05: Cross-org bulk approve | Mitigated — per-record `application.organizationId !== officerOrgId` check |
| T-21-06: Non-officer bulk approve | Mitigated — `requirePosition([Secretary, President])` guard |
| T-21-07: Large applicationIds array | Mitigated — Zod validator on generated schema limits input |
| T-21-08: Bulk approve without audit | Mitigated — `auditAction` called with bulk summary |

## Self-Check

### Files exist
- `services/api-ts/src/handlers/association:member/bulkApproveMembershipApplications.ts` — EXISTS
- `services/api-ts/src/handlers/association:member/bulkApproveMembershipApplications.test.ts` — EXISTS

### Tests pass
- 8/8 tests pass

### Acceptance criteria
- `requirePosition` count >= 1: 2 ✓
- `organizationId` count >= 2: 3 ✓
- `succeeded` count >= 2: 4 ✓
- `failed` count >= 3: 7 ✓
- `db.transaction` count >= 1: 1 ✓
- test count >= 5: 8 ✓

## Self-Check: PASSED
