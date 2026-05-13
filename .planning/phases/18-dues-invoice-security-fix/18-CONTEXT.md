# Phase 18: Dues Invoice Security Fix - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Dues invoice endpoints enforce org-scoped authorization so only chapter officers can mark invoices paid or query dues data for their own chapter. This is a security hardening phase — no new features, no UI changes. All work is backend API auth enforcement.

</domain>

<decisions>
## Implementation Decisions

### Auth Enforcement Strategy
- Enforce officer role check per-handler via existing `requirePosition()` utility — matches the `getDuesDashboard` pattern already in use
- Treasurer + President positions can manage dues (mark paid, modify invoices) — consistent with existing `getDuesDashboard` check
- Query/read endpoints enforce org membership via `orgScopedPersonIds()` — members can view their own dues status but not other orgs' data
- Mutation endpoints (markDuesInvoicePaid, etc.) require officer position + org scope — two-layer check

### Error Response Behavior
- 403 responses use generic "Forbidden" message — no information leakage about why access was denied
- Proper 401/403 split: 401 for no session (UnauthorizedError), 403 for wrong role/org (ForbiddenError) — standard HTTP semantics already in codebase
- Log all authorization failures via existing Pino logger with correlationId — security audit trail

### Test Strategy
- Unit tests per handler mocking `requirePosition` + integration tests hitting real endpoints
- Dedicated cross-org isolation test: two orgs, verify Org A officer cannot touch Org B dues
- Regression test confirming existing officer payment flow still works after adding auth guards

### Claude's Discretion
User defers all remaining implementation details to best industry practices and standards. Claude has flexibility on: middleware ordering, specific error log format, test fixture structure, and handler-internal auth check placement.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requirePosition()` in `utils/officer-check.ts` — checks caller's position titles against allowed list, returns denial or null
- `orgScopedPersonIds()` in `core/org-scoped-persons.ts` — subquery returning person IDs belonging to an org via active membership
- `ForbiddenError` class in `core/errors.ts` — throws 403
- `UnauthorizedError` class in `core/errors.ts` — throws 401
- `officer-auth.ts` middleware in `middleware/` — route-level officer auth
- `org-context.ts` middleware in `middleware/` — sets organizationId on context
- `POSITION_TITLES` constants in `utils/position-titles.ts`

### Established Patterns
- `getDuesDashboard.ts` already demonstrates the pattern: check session → set orgId on ctx → call requirePosition → proceed or throw
- Association operations handlers (createTraining, deleteTraining, createEvent) use same `requirePosition()` pattern
- Test pattern: mock `requirePosition` to isolate handler logic in unit tests

### Integration Points
- 15 dues handler files under `services/api-ts/src/handlers/dues/`
- Dues routes registered in `app.ts` (line 26: `registerDuesJobs`)
- Dues schema in `repos/dues-payments.schema.ts` with orgIdx indexes already present

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user accepts all recommendations and defers to best practices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
