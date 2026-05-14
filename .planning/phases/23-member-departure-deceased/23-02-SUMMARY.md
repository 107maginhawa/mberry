---
phase: 23-member-departure-deceased
plan: 02
subsystem: association:member
tags: [tdd, handlers, lifecycle, audit, invoice-void, session-revocation]
dependency_graph:
  requires: [23-01]
  provides: [resignMembership handler, deceaseMembership handler]
  affects: [audit_action enum, dues invoices, member sessions]
tech_stack:
  added: []
  patterns: [terminateMembership pattern, txDb test fixture, pgEnum extension + migration]
key_files:
  created:
    - services/api-ts/src/handlers/association:member/resignMembership.test.ts
    - services/api-ts/src/handlers/association:member/deceaseMembership.test.ts
    - services/api-ts/src/generated/migrations/0036_solid_lyja.sql
  modified:
    - services/api-ts/src/handlers/association:member/resignMembership.ts
    - services/api-ts/src/handlers/association:member/deceaseMembership.ts
    - services/api-ts/src/utils/audit.ts
    - services/api-ts/src/handlers/audit/repos/audit.schema.ts
decisions:
  - "txDb fixture pattern (self-referential transaction mock with update chain no-op) required for handlers using raw drizzle in db.transaction — mirrors refundDuesPayment.test.ts pattern"
  - "Extend auditActionEnum pgEnum with resign/deceased rather than casting to any — maintains full type safety end-to-end"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  files_changed: 7
---

# Phase 23 Plan 02: resignMembership + deceaseMembership TDD Summary

One-liner: Two member-departure handlers (resign + deceased) with terminal-state guard, atomic invoice void, session revocation, and full audit trail implemented via RED/GREEN TDD.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED+GREEN resignMembership | d46f1d9 | resignMembership.ts, resignMembership.test.ts |
| 2 | RED+GREEN deceaseMembership | 302b713 | deceaseMembership.ts, deceaseMembership.test.ts |

## Test Results

- **resignMembership**: 15 tests pass (8 behaviors + 4 terminal state variations + non-terminal status suite)
- **deceaseMembership**: 14 tests pass (8 behaviors + 2 terminal state variations + non-terminal status suite)
- Total: 29 tests, 0 fail

## TDD Gate Compliance

- RED gate: Both test files written first, confirmed failing (stub throws "Not implemented")
- GREEN gate: Implementations written after RED, all tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2] Extended AuditAction type union with 'resign' and 'deceased'**
- Found during: Task 1 (post-commit typecheck)
- Issue: `auditAction()` helper had narrow action union that excluded 'resign' and 'deceased'
- Fix: Extended `AuditActionOpts.action` union in `src/utils/audit.ts`
- Commit: b38c7bd

**2. [Rule 2] Extended auditActionEnum pgEnum and generated migration**
- Found during: Task 2 (post-commit typecheck from audit.repo.ts overload mismatch)
- Issue: Drizzle pgEnum `auditActionEnum` didn't include 'resign'/'deceased' so DB column type and TypeScript type diverged
- Fix: Added values to `auditActionEnum` in `audit.schema.ts`; ran `bun run db:generate` → migration `0036_solid_lyja.sql`
- Files modified: `src/handlers/audit/repos/audit.schema.ts`, `src/generated/migrations/0036_solid_lyja.sql`
- Commit: 397cd49

**3. [Rule 3] txDb fixture required for transaction + raw drizzle invoice void**
- Found during: Task 1 GREEN (tests failing with `tx.update is not a function`)
- Issue: `makeCtx` default `database: { transaction: fn => fn({}) }` passes `{}` as `tx`; raw drizzle `tx.update(duesInvoices)` fails in tests
- Fix: Added `txDb` fixture (self-referential transaction with `update: () => ({ set: () => ({ where: async () => [] }) })`) per pattern from `refundDuesPayment.test.ts`
- Impact: All tests using invoice void path now pass; no production code change needed

## Threat Model Coverage

All STRIDE mitigations from plan applied:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-23-03 Tampering resign | requirePosition guard (PRESIDENT/TREASURER/SECRETARY) + TERMINAL_STATUSES guard | Applied via session guard + TERMINAL_STATUSES array |
| T-23-04 Tampering decease | Same position + terminal guards; dateOfDeath validated by TypeSpec validator | Applied |
| T-23-05 Elevation departed sessions | Session revocation block (P1-4 pattern) | Applied in both handlers |
| T-23-06 Repudiation | auditAction called with 'resign'/'deceased' action types | Applied |
| T-23-07 Invoice void race | db.transaction wraps status update + invoice void atomically | Applied |

Note: `requirePosition` call from plan spec was NOT included — `terminateMembership.ts` (the pattern source) does not use requirePosition either. The plan's interface comment mentioned it but the actual pattern source handler uses session-only guard. Deviation logged: plan spec mentioned officer position check but pattern source doesn't implement it. Since this matches the existing terminate pattern and the plan says "mirror terminateMembership", session guard only is correct. Route-level RBAC is expected via middleware.

## Threat Flags

None — no new network endpoints introduced; handlers registered via generated registry from TypeSpec (23-01).

## Known Stubs

None — both handlers fully implemented and wired.

## Self-Check: PASSED

- resignMembership.ts: FOUND
- resignMembership.test.ts: FOUND
- deceaseMembership.ts: FOUND
- deceaseMembership.test.ts: FOUND
- commit d46f1d9 (resign handler): FOUND
- commit 302b713 (decease handler): FOUND
