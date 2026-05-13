# Phase 12: Backend Auth — Route Protection - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Close authorization gaps on backend API routes. Ensure regular members get 403 on all officer-only endpoints. Enforce cross-org isolation (IDOR prevention) so an officer of Org A cannot access Org B's data. TDD approach: failing tests first (RED), then middleware implementation (GREEN).

</domain>

<decisions>
## Implementation Decisions

### Test Organization
- **D-01:** Split tests into 3 files matching TDD-AUTH-PLAN structure:
  - `route-protection-handwired.test.ts` — hand-wired `app.ts` routes (dues, membership, certificates, events, training, elections)
  - `route-protection-association.test.ts` — generated `/association/*` mutation routes
  - `route-protection-idor.test.ts` — cross-org isolation tests
- **D-02:** Use `apiAs(email)` helper from Phase 11 for role-based test requests. Member user = `member@memberry.ph`, officers = `treasurer@memberry.ph`, `secretary@memberry.ph`, `society@memberry.ph`.

### IDOR Test Data
- **D-03:** Add second org to seed data (not in-test setup). Reusable for Phase 14 E2E negative tests.
- **D-04:** Second org needs at least one officer with active `officer_term` record.

### Middleware Wiring
- **D-05:** Hand-wired routes in `app.ts` (dues, membership, certificates, etc.) — add `officerAuthMiddleware()` alongside existing `authMiddleware()`. Mirrors `platformAdminAuthMiddleware` pattern already in `app.ts`.
- **D-06:** Generated `/association/*` mutation routes — use handler-level `requireOrgRole()` checks from `utils/org-auth.ts`. Cannot inject per-route middleware since `registerOpenAPIRoutes()` wires those routes.
- **D-07:** Read-only `/association/*` GET routes for members (view events, view memberships) stay accessible. Only mutations (POST/PATCH/DELETE) need officer checks.

### Error Response Consistency
- **D-08:** Standardize on `throw ForbiddenError()` pattern (from `@/core/errors`). Error handler converts to JSON `{error: "...", status: 403}`. Consistent with existing `officerAuthMiddleware`.
- **D-09:** Don't refactor `org-auth.ts` return-style preemptively — only update if a handler is being modified as part of this phase.

### Claude's Discretion
- Test assertion style, describe/test grouping, mock setup patterns — follow existing test conventions in `middleware/*.test.ts`
- Exact list of ~35 endpoints to test — derive from TDD-AUTH-PLAN.md sections 1.1 and 1.2
- Whether to test with full app setup or lightweight Hono mocks — follow `custom-routes-auth.test.ts` pattern (lightweight mocks)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Plan & Requirements
- `docs/TDD-AUTH-PLAN.md` — Full TDD plan with exact test lists per section (1.1, 1.2, 1.3)
- `docs/UAT-CHECKLIST.md` — 267 testable items, source of truth for what needs protection

### Existing Middleware
- `services/api-ts/src/middleware/officer-auth.ts` — `officerAuthMiddleware()` implementation, checks `officer_term` table
- `services/api-ts/src/middleware/auth.ts` — `authMiddleware()` with role-based options
- `services/api-ts/src/middleware/platform-admin-auth.ts` — Pattern reference for admin middleware wiring

### Auth Utilities
- `services/api-ts/src/utils/org-auth.ts` — `requireOrgRole()`, `requireTenantAccess()`, `hasMinimumRole()` — handler-level auth checks
- `services/api-ts/src/core/errors.ts` — `ForbiddenError` class for consistent 403 responses

### Route Registration
- `services/api-ts/src/app.ts` — Main route wiring, where hand-wired middleware goes
- `services/api-ts/src/generated/openapi/routes.ts` — Generated route registration (DO NOT EDIT)

### Existing Tests (patterns to follow)
- `services/api-ts/src/middleware/custom-routes-auth.test.ts` — Auth protection test pattern (lightweight Hono mock)
- `services/api-ts/src/handlers/bug-class/auth-matrix.test.ts` — RBAC utility test pattern

### Phase 11 Infrastructure
- `services/api-ts/src/seed.ts` — Seed users (member, treasurer, secretary, society officer)
- `services/api-ts/src/seed-rich.ts` — Officer term records

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `officerAuthMiddleware()` — Already built, checks `officer_term` for active terms. Just needs wiring to more routes.
- `requireOrgRole()` — Handler-level role check returning 403 Response. Use for generated route handlers.
- `requireTenantAccess()` — Cross-org check comparing `orgMembership.orgId` to context `orgId`. Key for IDOR prevention.
- `apiAs(email)` — Phase 11 test helper for authenticated requests as specific users.
- `makeCtx()` — Test utility for creating mock Hono contexts with org membership.

### Established Patterns
- **app.ts middleware chain:** `app.use('/path/*', authMiddleware(), officerAuthMiddleware())` — sequential middleware
- **Generated route auth:** `/association/*` already has `authMiddleware()` + `orgContextMiddleware()`. Officer checks must happen at handler level.
- **Test pattern:** `custom-routes-auth.test.ts` creates minimal Hono app mirroring `app.ts` registration, tests without DB.
- **ForbiddenError throw:** Middleware throws, `app.onError` catches and returns JSON 403.

### Integration Points
- `app.ts` line ~180+ — where hand-wired routes mount with middleware
- `orgContextMiddleware()` — sets `orgId` and `orgMembership` on context, consumed by `requireTenantAccess()`
- `OfficerTermRepository.findActiveByPersonAndOrg()` — DB query backing officer check

</code_context>

<specifics>
## Specific Ideas

No specific requirements — follow TDD-AUTH-PLAN.md sections 1.1, 1.2, 1.3 exactly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-Backend Auth — Route Protection*
*Context gathered: 2026-05-08*
