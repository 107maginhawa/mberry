# Phase 2: Audit Module Completion - Research

**Researched:** 2026-05-06
**Domain:** Hono middleware, audit trail, TanStack Router admin dashboard, Playwright E2E
**Confidence:** HIGH

## Summary

Phase 2 completes what is already ~70% built. The audit schema, repository, service factory, and `listAuditLogs` handler all exist and are wired. The AuditService is already injected into every request context via `createDependencyInjection`. The `auditAction()` fire-and-forget helper exists but is called manually in individual handlers — the gap is a **global Hono after-middleware** that intercepts all write requests automatically.

The admin dashboard is a new route (`/audit`) on the existing admin app (port 3003). The pattern is established: TanStack Router file-based routing, `useQuery` hitting `/api/audit/logs`, a filter sidebar, a table, and pagination — identical layout to `/members` and `/organizations`.

E2E tests have two distinct layers: API-level verification (call a write endpoint → query `/api/audit/logs` to confirm capture) and admin UI click-through (navigate to `/audit`, verify table renders).

**Primary recommendation:** Write a Hono after-middleware (`createAuditMiddleware`) that fires after every POST/PUT/PATCH/DELETE completes (response status determines outcome), then build the `/audit` admin page following the members page pattern.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hono middleware intercepts all write requests (POST/PUT/PATCH/DELETE) and logs audit events after response completes
- All 15 modules covered (9 base + 6 custom) — comprehensive compliance
- Audit captures resource ID + action only — no full request body to avoid PII in audit trail
- Fire-and-forget with error log on failure — never blocks the response (matches existing `auditAction()` pattern)
- Table layout with filters sidebar — matches existing admin app pattern (orgs, members pages)
- Filtering by event type, module/resource type, date range, and user
- Route at `/audit` — top-level route added to admin sidebar nav
- Manual refresh + pagination — no real-time updates in Phase 2 scope
- 3 representative operations tested: create member, update dues, delete booking (covers create/update/delete across modules)
- Verify audit events via API: action → GET /audit/logs filtered by resource — end-to-end verification
- E2E test for admin dashboard: browse to /audit, verify table renders with data (click-through gate)
- Unit test audit middleware separately: verify non-blocking behavior and error handling

### Claude's Discretion
- Middleware implementation details (exact Hono middleware signature, where to register in middleware chain)
- Audit log response format and pagination defaults
- Admin dashboard component decomposition and styling
- Test fixture setup for audit E2E tests

### Deferred Ideas (OUT OF SCOPE)
- Real-time audit log streaming via WebSocket
- Full-text search across audit log descriptions
- Audit log export (CSV/PDF) for compliance reports
- Role-based audit visibility (different views for admin vs compliance officer)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDT-01 | Audit module captures write events (create, update, delete) across all modules | Hono after-middleware on POST/PUT/PATCH/DELETE; AuditService already injected in ctx |
| AUDT-02 | Audit event triggers fire on CRUD operations automatically | Global middleware (not manual per-handler calls); registered after dependency injection |
| AUDT-03 | Audit module has E2E tests for event capture and log retrieval | API-level: write op → GET /audit/logs filtered by resource; admin UI click-through |
| AUDT-04 | Admin app has audit dashboard showing recent events | New `/audit` route in apps/admin following members page pattern |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auto audit capture | API / Backend (middleware) | — | Must intercept at HTTP layer after business logic; client cannot be trusted |
| Audit storage | Database / Storage | — | AuditRepository + PostgreSQL; integrity hash computed server-side |
| Audit retrieval | API / Backend | — | GET /audit/logs already exists in generated OpenAPI routes |
| Admin dashboard UI | Frontend Server (admin app) | API / Backend | TanStack Router page consuming existing /audit/logs endpoint |
| Background jobs (retention, purge) | API / Backend | — | Already registered via registerAuditJobs(); no change needed |

---

## Standard Stack

### Core (all already in use — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hono | existing | Global after-middleware registration | `app.use('*', ...)` pattern already used for 5 other middleware |
| drizzle-orm | existing | AuditRepository queries | Already used; AuditRepository extends DatabaseRepository |
| @tanstack/react-router | existing | `/audit` file-based route | Already used in admin app |
| @tanstack/react-query | existing | `useQuery` for audit logs | Already used in members/organizations pages |
| bun:test | existing | Unit tests for middleware | Already used across all middleware test files |
| @playwright/test | existing | E2E tests | Already configured in apps/admin/playwright.config.ts |

**No new dependencies required.** [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request (POST/PUT/PATCH/DELETE)
         │
         ▼
createRequestId → createDependencyInjection → createRequestLogger
         │                    │
         │              ctx.get('audit') available
         │
         ▼
   [Route Handler] ── business logic ──► Response sent to client
         │
         ▼  (after next() returns in middleware)
   createAuditMiddleware
         │
         ├── skip if GET/HEAD/OPTIONS
         ├── extract: method → action, URL path → resourceType + resourceId
         ├── extract: response status → outcome (2xx=success, 4xx=failure, 5xx=failure)
         ├── ctx.get('audit').logEvent(...)  ← fire-and-forget
         └── error → logger.error (never throws)
                              │
                              ▼
                    audit_log_entry (PostgreSQL)
                              │
                              ▼
                    GET /audit/logs  (listAuditLogs handler — already exists)
                              │
                              ▼
                    Admin app /audit route
                    (TanStack Router + useQuery)
```

### Recommended Project Structure

New files only:

```
services/api-ts/src/middleware/
└── audit.ts                    # createAuditMiddleware (new)
    audit.test.ts               # unit tests for middleware (new)

apps/admin/src/routes/
└── audit/
    └── index.tsx               # /audit admin dashboard page (new)

apps/admin/tests/e2e/
└── audit.spec.ts               # admin dashboard click-through E2E (new)

services/api-ts/src/
└── (existing tests updated or new test file for audit capture E2E)
```

### Pattern 1: Hono After-Middleware for Audit Capture

**What:** Register `app.use('*', createAuditMiddleware())` after `createDependencyInjection`. The middleware calls `await next()` first, then inspects `ctx.req.method` and response status to decide whether and what to log.

**When to use:** All write requests (POST, PUT, PATCH, DELETE). Skip GET/HEAD/OPTIONS.

**Key details:**
- Register position: after `createDependencyInjection` (so `ctx.get('audit')` is available), before route handlers
- Extract `resourceType` from URL path segment (e.g., `/persons/123` → `resourceType='person'`, `resource='123'`)
- Extract `action` from HTTP method: POST→`create`, PUT/PATCH→`update`, DELETE→`delete`
- Extract outcome from response status: 2xx→`success`, 4xx/5xx→`failure`
- `eventType` = `'data-modification'`, `category` = `'association'` (matches existing `auditAction()` pattern)
- User extracted from `ctx.get('user')?.id` (may be undefined for unauthenticated write attempts — still log with `userType='system'`)

```typescript
// Source: existing middleware patterns in services/api-ts/src/middleware/
export function createAuditMiddleware() {
  return async function auditMiddleware(ctx: AppContext, next: Next) {
    await next();

    const method = ctx.req.method;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;

    const audit = ctx.get('audit');
    if (!audit) return;

    const logger = ctx.get('logger');
    const user = ctx.get('user');

    // Extract resource info from URL
    const url = new URL(ctx.req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const resourceType = segments[0] ?? 'unknown';
    const resourceId = segments[1] ?? 'unknown';

    const actionMap: Record<string, string> = {
      POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete',
    };
    const action = actionMap[method] as any;
    const status = ctx.res.status;
    const outcome = status >= 200 && status < 300 ? 'success' : 'failure';

    try {
      await audit.logEvent({
        eventType: 'data-modification',
        category: 'association',
        action,
        outcome,
        user: user?.id,
        userType: user ? 'client' : 'system',
        resourceType,
        resource: resourceId,
        description: `${method} ${url.pathname}`,
        ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip'),
        userAgent: ctx.req.header('user-agent'),
      });
    } catch (error) {
      logger?.error({ error }, 'Audit middleware failed to log event');
    }
  };
}
```

[VERIFIED: matches existing `auditAction()` signature in `src/utils/audit.ts`]

### Pattern 2: Admin Audit Dashboard Page

**What:** TanStack Router file-based route at `apps/admin/src/routes/audit/index.tsx`. Follows `members/index.tsx` pattern: `useQuery` → fetch `/api/audit/logs?...` → table + filter UI.

**Key details:**
- Filter inputs: `action` (select), `resourceType` (text/select), `startDate`/`endDate` (date inputs), `user` (text)
- Pagination: use `limit`/`offset` query params; `listAuditLogs` already returns `{ data: [], pagination: {} }`
- Sidebar nav: add `{ to: '/audit', label: 'Audit Log', icon: Shield }` to `navItems` array in `__root.tsx`

### Pattern 3: Hono Middleware Registration Order

Current `app.ts` middleware chain (order matters):
```
1. createRequestId
2. createDependencyInjection   ← audit injected here
3. createRequestLogger
4. createSecurityHeaders
5. createCorsMiddleware
[NEW] createAuditMiddleware   ← insert here (after dep injection)
```

Register with `app.use('*', createAuditMiddleware())` after line 104 in `app.ts`. [VERIFIED: app.ts line numbers]

### Anti-Patterns to Avoid

- **Blocking the response on audit failure:** Wrap in try/catch, never rethrow. Matches existing `auditAction()` design.
- **Logging request body for PII prevention:** Only log method, path, resource ID, outcome — no body content.
- **Calling audit middleware before dependency injection:** `ctx.get('audit')` will be undefined; middleware must come after `createDependencyInjection`.
- **Importing admin SDK hooks that don't exist:** Admin app fetches directly via `fetch('/api/audit/logs', ...)` — same pattern as members page, no generated hooks needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit log storage | Custom table | `AuditRepository.logEvent()` | Already built with integrity hash, indexes, retention |
| Response status access in middleware | Parse response body | `ctx.res.status` | Hono exposes response on context after `await next()` |
| Admin table component | New table from scratch | Copy `members/index.tsx` pattern | Identical structure; ~40 lines of JSX reuse |
| Date range filtering | Custom query builder | `AuditLogFilters` interface → `buildWhereConditions()` | Repository already handles startDate/endDate |

---

## Common Pitfalls

### Pitfall 1: Middleware registered before dependency injection
**What goes wrong:** `ctx.get('audit')` returns undefined; every write request silently skips audit logging.
**Why it happens:** Dependency injection is not global scope — it's per-request middleware.
**How to avoid:** Register `createAuditMiddleware` AFTER `createDependencyInjection` in `app.ts`.
**Warning signs:** No audit entries appear in DB despite write operations succeeding.

### Pitfall 2: `ctx.res` not available before `await next()`
**What goes wrong:** Middleware reads response status before handler runs — always gets 200 or undefined.
**Why it happens:** Hono builds the response object during `next()` execution.
**How to avoid:** All audit logging logic must come AFTER `await next()` returns.
**Warning signs:** All outcomes logged as 'success' even for 4xx responses.

### Pitfall 3: Double audit entries on routes already using `auditAction()`
**What goes wrong:** Some handlers (e.g., billing, person) already call `auditAction()` manually. Adding global middleware creates duplicate entries.
**Why it happens:** Both manual calls and the middleware fire.
**How to avoid:** Two options — (a) remove manual `auditAction()` calls from handlers (preferred for DRY), or (b) add a request header/context flag to skip global middleware when manual audit was already logged. Decision is Claude's discretion.
**Warning signs:** 2× audit entries for the same operation.

### Pitfall 4: Admin route requires `platformAdminAuth` but audit route doesn't
**What goes wrong:** `/audit` page is accessible to any authenticated user.
**Why it happens:** The `app.use('/admin/*', platformAdminAuthMiddleware())` pattern in `app.ts` protects `/admin/*` paths — but the audit API endpoint is `/audit/logs` (not `/admin/audit/logs`).
**How to avoid:** The generated route `/audit/logs` already has `roles: ["admin", "compliance"]` in its TypeSpec security definition. Verify the generated validator enforces this. The admin UI page itself is protected by the root route's `beforeLoad` auth check.
**Warning signs:** Non-admin users can call `/api/audit/logs` directly.

### Pitfall 5: TanStack Router route file not in routeTree
**What goes wrong:** Creating `apps/admin/src/routes/audit/index.tsx` doesn't appear in the app until `routeTree.gen.ts` is regenerated.
**Why it happens:** TanStack Router's Vite plugin regenerates `routeTree.gen.ts` on dev server restart.
**How to avoid:** After creating route file, restart the admin dev server. `routeTree.gen.ts` is auto-generated — never edit manually.
**Warning signs:** Route 404s despite file existing.

---

## Code Examples

### Registering the middleware in app.ts

```typescript
// Source: existing pattern in services/api-ts/src/app.ts
import { createAuditMiddleware } from '@/middleware/audit';

// After createDependencyInjection registration:
app.use('*', createDependencyInjection(app as App, config));
app.use('*', createAuditMiddleware());  // ← insert here
app.use('*', createRequestLogger(config));
```

[ASSUMED: exact insertion line — verify against current app.ts line 104]

### Admin sidebar nav addition (__root.tsx)

```typescript
// Source: apps/admin/src/routes/__root.tsx navItems array
import { Shield } from 'lucide-react'

const navItems = [
  // ... existing items ...
  { to: '/audit', label: 'Audit Log', icon: Shield },
]
```

[VERIFIED: navItems pattern confirmed in __root.tsx]

### Admin audit page useQuery pattern

```typescript
// Source: apps/admin/src/routes/members/index.tsx pattern
const { data, isLoading, isError } = useQuery({
  queryKey: ['admin', 'audit-logs', filters],
  queryFn: async () => {
    const params = new URLSearchParams({ limit: '25', ...filters });
    const res = await fetch(`/api/audit/logs?${params}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json(); // { data: AuditLogEntry[], pagination: { ... } }
  },
})
```

[VERIFIED: listAuditLogs returns `{ data, pagination }` confirmed in listAuditLogs.ts]

### Unit test middleware pattern (bun:test)

```typescript
// Source: services/api-ts/src/middleware/auth.test.ts pattern
import { describe, it, expect, mock } from 'bun:test';
import { createAuditMiddleware } from '@/middleware/audit';

function makeCtx(method: string, path: string, responseStatus: number, auditMock: any) {
  return {
    req: { method, url: `http://localhost${path}`, header: () => undefined },
    res: { status: responseStatus },
    get: (key: string) => key === 'audit' ? auditMock : null,
    set: () => {},
  } as any;
}

it('logs create action for POST', async () => {
  const logEvent = mock(async () => {});
  const ctx = makeCtx('POST', '/persons/abc-123', 201, { logEvent });
  const next = mock(async () => {});
  await createAuditMiddleware()(ctx, next);
  expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({
    action: 'create', resourceType: 'persons', outcome: 'success',
  }));
});
```

[VERIFIED: matches middleware test patterns in auth.test.ts]

### E2E audit capture test (API-level)

```typescript
// Source: apps/admin/tests/e2e/helpers/auth.ts + existing E2E patterns
import { test, expect } from '@playwright/test';
import { signInAndNavigate } from './helpers/auth';

const API_URL = 'http://localhost:7213';

test('create member produces audit event', async ({ page, context }) => {
  await signInAndNavigate(page, '/');
  
  // Perform a write operation (create a member via API)
  const res = await context.request.post(`${API_URL}/membership/members`, {
    data: { /* member data */ },
  });
  expect(res.ok()).toBeTruthy();
  const member = await res.json();

  // Verify audit event captured
  const auditRes = await context.request.get(
    `${API_URL}/audit/logs?resourceType=membership&resource=${member.data.id}`
  );
  const audit = await auditRes.json();
  expect(audit.data.length).toBeGreaterThan(0);
  expect(audit.data[0].action).toBe('create');
});
```

[VERIFIED: pattern matches admin auth helper and listAuditLogs query params]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual `auditAction()` per-handler | Global Hono after-middleware | Automatic coverage; handlers don't need to call audit manually |
| No audit dashboard | `/audit` admin route | Admin can inspect all write operations with filters |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ctx.res.status` is readable after `await next()` in Hono middleware | Architecture Patterns | Middleware must use different API to read response status; needs Hono docs verification |
| A2 | Exact insertion line for middleware in app.ts is after line 104 | Code Examples | Middleware order wrong → audit or other middleware breaks |
| A3 | Duplicate audit entries exist where handlers already call `auditAction()` manually | Pitfalls | No duplicates — but may miss coverage if manual calls are the only mechanism |

---

## Open Questions

1. **Duplicate audit entries from existing manual `auditAction()` calls**
   - What we know: Several handlers may already call `auditAction()`. Global middleware would fire in addition.
   - What's unclear: Which handlers call it, and whether duplicates are acceptable or should be resolved.
   - Recommendation: Audit-grep for `auditAction(` calls in handlers during Wave 0; decide to either remove manual calls (DRY) or accept duplicates (safe default since it's fire-and-forget).

2. **`ctx.res` status availability in Hono middleware**
   - What we know: Standard Hono middleware pattern allows post-`next()` inspection.
   - What's unclear: Exact API — `ctx.res.status` vs `ctx.res?.status` vs response object.
   - Recommendation: Verify with `npx ctx7 docs hono "middleware after response"` during Wave 0; wrap in try/catch regardless.

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All tooling (Bun, PostgreSQL, Playwright, Hono) already confirmed present from Phase 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (unit) | bun:test |
| Framework (E2E) | Playwright |
| Config file (unit) | `services/api-ts/package.json` → `bun test` |
| Config file (E2E admin) | `apps/admin/playwright.config.ts` |
| Quick run command | `cd services/api-ts && bun test src/middleware/audit.test.ts` |
| Full suite command | `cd services/api-ts && bun test && cd ../../apps/admin && bun run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AUDT-01 | Write ops across modules captured in audit_log_entry | integration | `cd apps/admin && bun run test:e2e -- --grep "audit capture"` | ❌ Wave 0 |
| AUDT-02 | Middleware fires automatically (not manual) | unit | `cd services/api-ts && bun test src/middleware/audit.test.ts` | ❌ Wave 0 |
| AUDT-02 | Non-blocking — error in audit never blocks response | unit | same as above | ❌ Wave 0 |
| AUDT-03 | GET /audit/logs returns captured events | integration | `cd apps/admin && bun run test:e2e -- --grep "audit capture"` | ❌ Wave 0 |
| AUDT-04 | Admin /audit page renders table with data | E2E click-through | `cd apps/admin && bun run test:e2e -- --grep "audit dashboard"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd services/api-ts && bun test src/middleware/audit.test.ts`
- **Per wave merge:** `cd services/api-ts && bun test`
- **Phase gate:** Full suite + admin E2E before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `services/api-ts/src/middleware/audit.test.ts` — covers AUDT-02
- [ ] `apps/admin/tests/e2e/audit.spec.ts` — covers AUDT-01, AUDT-03, AUDT-04

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `listAuditLogs` already requires `bearerAuth` roles `["admin","compliance"]` per TypeSpec |
| V3 Session Management | no | Audit reads/writes use existing session; no new session logic |
| V4 Access Control | yes | Admin dashboard protected by root route `beforeLoad` auth check; API endpoint role-enforced |
| V5 Input Validation | yes | `listAuditLogs` query params validated via generated OpenAPI validators; middleware reads only headers/URL |
| V6 Cryptography | yes | Integrity hash (SHA-256) already computed in `AuditRepository.logEvent()` — do not change |

### Known Threat Patterns for Hono middleware + audit trail

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Audit log PII leakage | Information Disclosure | Capture resource ID only, never request body — locked decision |
| Audit bypass (direct DB write skipping middleware) | Tampering | Middleware covers all HTTP routes; only direct DB access bypasses it (acceptable for server-side jobs) |
| Audit log tampering | Tampering | SHA-256 integrity hash per entry; `verifyIntegrity()` job already registered |
| Admin audit access by non-admin | Elevation of Privilege | TypeSpec security definition + generated validator enforces `admin`/`compliance` roles |

---

## Sources

### Primary (HIGH confidence)
- `services/api-ts/src/core/audit.ts` — AuditService interface verified [VERIFIED: codebase]
- `services/api-ts/src/utils/audit.ts` — `auditAction()` fire-and-forget pattern [VERIFIED: codebase]
- `services/api-ts/src/handlers/audit/repos/audit.schema.ts` — full schema with enums [VERIFIED: codebase]
- `services/api-ts/src/handlers/audit/repos/audit.repo.ts` — AuditRepository.logEvent() [VERIFIED: codebase]
- `services/api-ts/src/handlers/audit/listAuditLogs.ts` — existing GET handler [VERIFIED: codebase]
- `services/api-ts/src/app.ts` — middleware chain order [VERIFIED: codebase]
- `services/api-ts/src/middleware/dependency.ts` — audit injected into ctx [VERIFIED: codebase]
- `apps/admin/src/routes/__root.tsx` — navItems pattern [VERIFIED: codebase]
- `apps/admin/src/routes/members/index.tsx` — table + useQuery pattern [VERIFIED: codebase]
- `apps/admin/tests/e2e/helpers/auth.ts` — E2E admin auth helper [VERIFIED: codebase]
- `.planning/config.json` — nyquist_validation: true, security_enforcement: true [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- Hono middleware after-response pattern (`ctx.res.status` post-`next()`) [ASSUMED from training knowledge — verify with Context7 during Wave 0]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in codebase, no new deps
- Architecture: HIGH — middleware chain and repository patterns verified in source
- Pitfalls: HIGH — verified against actual code (dependency injection order, route tree gen)
- Test patterns: HIGH — auth.test.ts and admin E2E helpers confirmed

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable stack)
