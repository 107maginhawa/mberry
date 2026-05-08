# Phase 12: Backend Auth — Route Protection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 12-backend-auth-route-protection
**Areas discussed:** Test file organization, IDOR test data setup, Middleware wiring approach, 403 response consistency

---

## Test File Organization

| Option | Description | Selected |
|--------|-------------|----------|
| One big file | All ~35 tests in single file | |
| Per-module split | Separate file per handler module (dues, membership, etc.) | |
| Per-route-group | Split by TDD-AUTH-PLAN sections (hand-wired, association, IDOR) | ✓ |

**User's choice:** Deferred to Claude — "up to you lets do whats needed"
**Notes:** Per-route-group chosen to match TDD-AUTH-PLAN structure (1.1, 1.2, 1.3). 3 files, each focused on a distinct authorization concern.

---

## IDOR Test Data Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Seed data | Add second org to existing seed scripts | ✓ |
| In-test setup | Create org/officer within each test | |

**User's choice:** Deferred to Claude
**Notes:** Seed data chosen for reusability — Phase 14 E2E tests will need the same second org.

---

## Middleware Wiring Approach

| Option | Description | Selected |
|--------|-------------|----------|
| officerAuthMiddleware in app.ts | For hand-wired routes, add middleware at mount point | ✓ (hand-wired) |
| Handler-level requireOrgRole | For generated routes, check in handler code | ✓ (generated) |
| Single approach everywhere | Force one pattern for all routes | |

**User's choice:** Deferred to Claude
**Notes:** Dual approach matches codebase reality — hand-wired routes can take middleware in app.ts (like platformAdminAuth), generated routes need handler-level checks since registerOpenAPIRoutes controls wiring.

---

## 403 Response Consistency

| Option | Description | Selected |
|--------|-------------|----------|
| ForbiddenError throw | Throw error, let error handler convert to JSON | ✓ |
| ctx.json return | Return response directly from middleware/handler | |
| Mixed (leave as-is) | Don't standardize | |

**User's choice:** Deferred to Claude
**Notes:** ForbiddenError throw chosen for consistency with existing officerAuthMiddleware. No preemptive refactoring of org-auth.ts utils.

---

## Claude's Discretion

- All four areas — user said "up to you lets do whats needed"
- Test assertion style, grouping, mock patterns
- Exact endpoint list derivation from TDD-AUTH-PLAN.md
- Lightweight vs full app test setup

## Deferred Ideas

None — discussion stayed within phase scope.
