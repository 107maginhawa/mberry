# Phase 2: Audit Module Completion - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the audit module so all write operations across all modules are automatically captured in an audit trail. Deliver automatic audit middleware, admin dashboard with filtering, and E2E tests verifying audit capture for representative CRUD operations.

</domain>

<decisions>
## Implementation Decisions

### Automatic Audit Trigger Mechanism
- Hono middleware intercepts all write requests (POST/PUT/PATCH/DELETE) and logs audit events after response completes
- All 15 modules covered (9 base + 6 custom) — comprehensive compliance
- Audit captures resource ID + action only — no full request body to avoid PII in audit trail
- Fire-and-forget with error log on failure — never blocks the response (matches existing `auditAction()` pattern)

### Admin Audit Dashboard
- Table layout with filters sidebar — matches existing admin app pattern (orgs, members pages)
- Filtering by event type, module/resource type, date range, and user
- Route at `/audit` — top-level route added to admin sidebar nav
- Manual refresh + pagination — no real-time updates in Phase 2 scope

### E2E Test Strategy
- 3 representative operations tested: create member, update dues, delete booking (covers create/update/delete across modules)
- Verify audit events via API: action → GET /audit/logs filtered by resource — end-to-end verification
- E2E test for admin dashboard: browse to /audit, verify table renders with data (click-through gate)
- Unit test audit middleware separately: verify non-blocking behavior and error handling

### Claude's Discretion
- Middleware implementation details (exact Hono middleware signature, where to register in middleware chain)
- Audit log response format and pagination defaults
- Admin dashboard component decomposition and styling
- Test fixture setup for audit E2E tests

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/api-ts/src/core/audit.ts` — AuditService interface + factory, already injected via dependency middleware
- `services/api-ts/src/utils/audit.ts` — `auditAction()` fire-and-forget helper with user/IP extraction
- `services/api-ts/src/handlers/audit/repos/audit.schema.ts` — Full Drizzle schema with enums, indexes
- `services/api-ts/src/handlers/audit/repos/audit.repo.ts` — AuditRepository with logEvent, verifyIntegrity, archiveOldLogs, getAuditStatistics
- `services/api-ts/src/handlers/audit/listAuditLogs.ts` — Existing list handler with filtering
- `services/api-ts/src/handlers/audit/jobs/` — Background jobs (integrity verification, retention)

### Established Patterns
- Dependency injection via `middleware/dependency.ts` — audit service already injected as `ctx.get('audit')`
- Handler pattern: Router -> Validators -> Handlers -> Repositories
- Admin app uses TanStack Router file-based routing at `apps/admin/src/routes/`
- Admin app has platformAdminAuth middleware protecting `/admin/*` routes
- Existing admin pages: organizations, associations, members, operators, feature-flags, impersonate

### Integration Points
- Middleware chain in `app.ts` — new audit middleware registers after dependency injection (needs `ctx.get('audit')`)
- Admin app sidebar navigation — add `/audit` entry
- Existing `listAuditLogs` handler serves GET `/audit/logs` — admin dashboard consumes this
- `registerAuditJobs()` already called in app initialization

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established patterns.

</specifics>

<deferred>
## Deferred Ideas

- Real-time audit log streaming via WebSocket (future enhancement)
- Full-text search across audit log descriptions
- Audit log export (CSV/PDF) for compliance reports
- Role-based audit visibility (different views for admin vs compliance officer)

</deferred>
