# Phase 12: Backend Auth -- Route Protection - Research

**Researched:** 2026-05-08
**Domain:** Hono middleware, RBAC, IDOR prevention, TDD
**Confidence:** HIGH

## Summary

Phase 12 closes authorization gaps on two categories of backend routes: (1) hand-wired inline routes in `app.ts` that currently use only `authMiddleware()`, and (2) generated `/association/*` mutation routes that need handler-level officer checks. The existing `officerAuthMiddleware()` and `requireOrgRole()` utilities are already built and tested -- this phase is about wiring them to the remaining unprotected endpoints.

The codebase has a split architecture: module routers (e.g., `handlers/dues/index.ts`) already have `officerAuth` middleware, but these routers are NOT mounted in `app.ts`. Instead, `app.ts` has inline route definitions with only `authMiddleware()`. The module routers are effectively dead code for hand-wired paths. Per D-05, the fix is adding `officerAuthMiddleware()` directly to the inline `app.ts` routes, not refactoring to use the module routers.

**Primary recommendation:** Follow TDD-AUTH-PLAN sections 1.1, 1.2, 1.3 exactly. Use the lightweight Hono mock test pattern from `custom-routes-auth.test.ts` for route protection tests, and `apiAs()` integration helper for IDOR tests that need real DB context.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Split tests into 3 files: `route-protection-handwired.test.ts`, `route-protection-association.test.ts`, `route-protection-idor.test.ts`
- **D-02:** Use `apiAs(email)` helper with seed users: `member@memberry.ph`, `treasurer@memberry.ph`, `secretary@memberry.ph`, `society@memberry.ph`
- **D-03:** Add second org to seed data (not in-test setup), reusable for Phase 14
- **D-04:** Second org needs at least one officer with active `officer_term` record
- **D-05:** Hand-wired routes in `app.ts` -- add `officerAuthMiddleware()` alongside existing `authMiddleware()`. Mirrors `platformAdminAuthMiddleware` pattern.
- **D-06:** Generated `/association/*` mutation routes -- use handler-level `requireOrgRole()` checks from `utils/org-auth.ts`. Cannot inject per-route middleware since `registerOpenAPIRoutes()` wires those routes.
- **D-07:** Read-only `/association/*` GET routes stay accessible to members. Only mutations (POST/PATCH/DELETE) need officer checks.
- **D-08:** Standardize on `throw ForbiddenError()` pattern from `@/core/errors`. Error handler converts to JSON `{error: "...", status: 403}`.
- **D-09:** Don't refactor `org-auth.ts` return-style preemptively -- only update if a handler is being modified.

### Claude's Discretion
- Test assertion style, describe/test grouping, mock setup patterns -- follow existing test conventions
- Exact list of ~35 endpoints to test -- derive from TDD-AUTH-PLAN.md sections 1.1 and 1.2
- Whether to test with full app setup or lightweight Hono mocks -- follow `custom-routes-auth.test.ts` pattern

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route protection (hand-wired) | API / Backend | -- | Middleware chain in `app.ts` inline routes |
| Route protection (generated) | API / Backend | -- | Handler-level `requireOrgRole()` in each handler |
| Cross-org isolation (IDOR) | API / Backend | -- | `orgContextMiddleware` + `requireTenantAccess()` on context |
| Test infrastructure | API / Backend | -- | Bun test runner, mock Hono apps, `apiAs()` integration helper |
| Second org seed data | Database / Storage | -- | Seed script additions for test fixtures |

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hono | (project version) | Middleware chain, route registration | Already used throughout `app.ts` |
| Bun test | (project version) | Test runner | Project standard per CLAUDE.md |
| `officerAuthMiddleware` | N/A (custom) | Officer term verification | Already built in `middleware/officer-auth.ts` |
| `requireOrgRole` | N/A (custom) | Handler-level role check | Already built in `utils/org-auth.ts` |
| `ForbiddenError` | N/A (custom) | 403 error throwing | Already built in `core/errors.ts` |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `apiAs()` | N/A (custom) | Authenticated test requests | Integration/IDOR tests needing real sessions |
| `makeCtx()` | N/A (custom) | Mock Hono context | Unit tests for handler-level auth checks |

No new dependencies needed. All tools exist in the codebase.

## Architecture Patterns

### System Architecture Diagram

```
Request → authMiddleware() → officerAuthMiddleware() → Handler
  │              │                     │                   │
  │         Sets user/session    Checks officer_term   Business logic
  │         on context           for :orgId param
  │                                    │
  │                              No active term?
  │                              throw ForbiddenError()
  │
  └─ /association/* routes:
     authMiddleware() → orgContextMiddleware() → Handler → requireOrgRole()
                              │                               │
                        Sets orgId,                    Returns 403 Response
                        orgMembership                  if role not in allowed list
```

### Two Authorization Strategies

**Strategy A: Middleware-level (hand-wired routes in app.ts)**
- Routes with `:orgId` in path use `officerAuthMiddleware()` which queries `officer_term` table
- Middleware throws `ForbiddenError` if no active term found
- Wired as: `app.put('/path/:orgId', authMiddleware(), officerAuthMiddleware(), handler)`

**Strategy B: Handler-level (generated /association/* routes)**
- `registerOpenAPIRoutes()` cannot accept per-route middleware injection
- Handlers call `requireOrgRole(ctx, ['president', 'treasurer', ...])` at top of function
- Returns 403 Response (not thrown) -- different pattern from Strategy A
- Per D-09, do NOT refactor this to throw-style unless handler is being modified

### Key Code Locations

| File | Role | Modification Type |
|------|------|-------------------|
| `services/api-ts/src/app.ts` (lines 270-410) | Inline hand-wired routes | Add `officerAuthMiddleware()` to middleware chain |
| `services/api-ts/src/generated/openapi/routes.ts` | Generated route registration | DO NOT EDIT -- handler-level checks instead |
| `services/api-ts/src/handlers/*/` | Handler implementations | Add `requireOrgRole()` calls to mutation handlers |
| `services/api-ts/src/seed.ts` | Seed data | Add second org + officer |
| `services/api-ts/src/middleware/officer-auth.ts` | Officer check middleware | No changes needed |
| `services/api-ts/src/utils/org-auth.ts` | Role check utilities | No changes needed |

### Anti-Patterns to Avoid
- **Editing generated routes.ts:** This file is regenerated. Any middleware injection here will be overwritten. Use handler-level checks instead.
- **Mixing throw vs return-style in same handler:** `officerAuthMiddleware` throws `ForbiddenError`; `requireOrgRole` returns a Response. Don't mix within a single handler -- pick the one that matches the route category.
- **Testing with full app boot:** Creates fragile, slow tests. Use lightweight Hono mock pattern from `custom-routes-auth.test.ts`.
- **Putting IDOR tests in unit test files:** IDOR tests need real DB context with two orgs. These are integration tests using `apiAs()` and require running API server.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Officer term verification | Custom DB query in each route | `officerAuthMiddleware()` | Already handles edge cases (no orgId param, no user, no active term) |
| Role-based access check | Manual role comparison | `requireOrgRole(ctx, roles)` | Handles missing membership, role hierarchy |
| Cross-org isolation | Manual orgId comparison | `requireTenantAccess(ctx)` | Compares `orgMembership.orgId` to context `orgId` |
| Auth test HTTP client | Manual fetch + cookie | `apiAs(email)` | Handles sign-in, cookie extraction, request methods |
| Mock Hono context | Ad-hoc ctx objects | `makeCtx(overrides)` | Consistent shape, user/session/org setup |

## Common Pitfalls

### Pitfall 1: officerAuthMiddleware Skips Routes Without :orgId
**What goes wrong:** `officerAuthMiddleware()` silently calls `next()` when no `:orgId` param exists in the route path. Routes like `POST /dues/payments` (no orgId) pass through unchecked.
**Why it happens:** The middleware is designed for routes with `:orgId`. For routes without it, per-handler checks are expected.
**How to avoid:** For routes without `:orgId` in the path, add handler-level `requireOrgRole()` checks. The TDD-AUTH-PLAN lists `POST /dues/payments` and `POST /dues/payments/:id/refund` as needing this treatment.
**Warning signs:** Tests passing for routes with `:orgId` but member still accessing routes without `:orgId`.

### Pitfall 2: orgContextMiddleware Sets role='member' for All Memberships
**What goes wrong:** `orgContextMiddleware` always sets `orgMembership.role = 'member'` regardless of actual officer status. So `requireOrgRole(ctx, ['president'])` will ALWAYS deny because the role is always 'member'.
**Why it happens:** The middleware comment says "role granularity comes from governance module" -- it doesn't query officer_term.
**How to avoid:** For generated `/association/*` routes, officer checks must query `officer_term` table directly in the handler, similar to how `officerAuthMiddleware` works. Cannot rely on `orgMembership.role` from context.
**Warning signs:** All officers getting 403 on `/association/*` mutation routes even though they have active terms.

### Pitfall 3: Inline app.ts Routes vs Module Router Routes
**What goes wrong:** Confusion between the inline routes in `app.ts` (lines 270-410) and the module router files (`handlers/dues/index.ts`, `handlers/membership/index.ts`). The module routers have `officerAuth` but are NOT mounted.
**Why it happens:** Module routers were created but never wired into `app.ts`. The inline routes are what actually serves requests.
**How to avoid:** Only modify the inline routes in `app.ts`. Don't assume the module routers are active.
**Warning signs:** Adding middleware to `handlers/dues/index.ts` and wondering why tests still pass without it.

### Pitfall 4: IDOR Test Requires Real Second Org in Seed Data
**What goes wrong:** Cross-org tests fail with 404 or unexpected errors because second org doesn't exist.
**Why it happens:** IDOR tests need two distinct orgs with officers, each having `officer_term` records. Without seed data, tests can't sign in as officer-of-org-B.
**How to avoid:** Per D-03/D-04, add second org to `seed.ts` with at least one officer and active `officer_term`. Run seed before IDOR tests.
**Warning signs:** IDOR tests returning 401 (no user) or 404 (no org) instead of expected 403.

### Pitfall 5: GET Routes That Should Stay Member-Accessible
**What goes wrong:** Over-protecting read endpoints. Members need to view events, their own memberships, announcements, etc.
**Why it happens:** Blanket application of officer middleware to all routes in a path group.
**How to avoid:** Per D-07, only mutations (POST/PATCH/DELETE) need officer checks on `/association/*` routes. GET routes stay accessible. The TDD-AUTH-PLAN explicitly lists which endpoints to test.
**Warning signs:** Member users unable to view events or announcements.

## Code Examples

### Pattern 1: Adding officerAuthMiddleware to inline app.ts route
```typescript
// Source: app.ts existing platform admin pattern (line 440)
// BEFORE (member can access):
app.put('/membership/org-profile/:orgId', authMiddleware(), async (ctx) => { ... });

// AFTER (officer-only):
app.put('/membership/org-profile/:orgId', authMiddleware(), officerAuthMiddleware(), async (ctx) => { ... });
```

### Pattern 2: Handler-level requireOrgRole for generated routes
```typescript
// Source: utils/org-auth.ts
import { requireOrgRole } from '@/utils/org-auth';

export async function createEvent(ctx: BaseContext) {
  // Officer check at handler level (generated routes can't use middleware)
  const denied = requireOrgRole(ctx, ['president', 'vice-president', 'secretary', 'officer']);
  if (denied) return denied;
  
  // ... handler logic
}
```

### Pattern 3: Lightweight Hono mock test (from custom-routes-auth.test.ts)
```typescript
// Source: services/api-ts/src/middleware/custom-routes-auth.test.ts
import { Hono } from 'hono';
import { authMiddleware } from '@/middleware/auth';

function makeProtectedApp() {
  const app = new Hono();
  
  // Mock auth returning null session (unauthenticated)
  app.use('*', async (ctx, next) => {
    ctx.set('auth', { api: { getSession: async () => null } });
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    await next();
  });
  
  app.use('/dues/*', authMiddleware());
  app.get('/dues/config/:orgId', (ctx) => ctx.json({ ok: true }));
  
  app.onError((err, ctx) => {
    if (err.message === 'Authentication required') return ctx.json({ error: err.message }, 401);
    if (err.message.includes('Officer access')) return ctx.json({ error: err.message }, 403);
    return ctx.json({ error: err.message }, 500);
  });
  
  return app;
}
```

### Pattern 4: Officer mock test (member gets 403)
```typescript
// Source: Derived from custom-routes-auth.test.ts + officer-auth.ts patterns
function makeOfficerProtectedApp() {
  const app = new Hono();
  
  // Mock auth returning a session (authenticated member, NOT officer)
  app.use('*', async (ctx, next) => {
    ctx.set('auth', {
      api: {
        getSession: async () => ({
          user: { id: 'member-user-id', role: 'user' },
          session: { id: 'sess-1' },
        }),
      },
    });
    ctx.set('user', { id: 'member-user-id', role: 'user' });
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    // Mock database with empty officer terms
    ctx.set('database', {}); 
    await next();
  });
  
  // Wire auth + officer middleware (mirrors app.ts target state)
  app.put('/membership/org-profile/:orgId', authMiddleware(), officerAuthMiddleware(), 
    (ctx) => ctx.json({ ok: true }));
  
  app.onError((err, ctx) => {
    if (err.message === 'Authentication required') return ctx.json({ error: err.message }, 401);
    if (err.message.includes('Officer access') || err.message.includes('Forbidden'))
      return ctx.json({ error: err.message }, 403);
    return ctx.json({ error: err.message }, 500);
  });
  
  return app;
}
```

### Pattern 5: IDOR test with apiAs (integration)
```typescript
// Source: Derived from tests/helpers/api-as.ts
import { apiAs } from '@/tests/helpers/api-as';

test('officer of Org A cannot access Org B roster', async () => {
  const orgAOfficer = await apiAs('treasurer@memberry.ph');
  const res = await orgAOfficer.get(`/membership/members/${ORG_B_ID}`);
  expect(res.status).toBe(403);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No officer auth on hand-wired routes | `authMiddleware()` only | Pre-Phase 12 | Any member can access officer endpoints |
| Module routers with officerAuth | Inline routes without officerAuth | Phase 5-10 | Module routers exist but are dead code |

**Current gap:** 14 hand-wired routes + ~18 generated mutation routes lack officer protection.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | None (Bun default) |
| Quick run command | `cd services/api-ts && bun test src/tests/route-protection` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements to Test Map

Derived from TDD-AUTH-PLAN.md sections 1.1, 1.2, 1.3:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-HW-01 | Member gets 403 on PUT /membership/org-profile/:orgId | unit (mock) | `bun test src/tests/route-protection-handwired.test.ts` | Wave 0 |
| AUTH-HW-02 | Member gets 403 on GET /membership/members/:orgId | unit (mock) | same file | Wave 0 |
| AUTH-HW-03 | Member gets 403 on GET /membership/applications/:orgId | unit (mock) | same file | Wave 0 |
| AUTH-HW-04 | Member gets 403 on GET /dues/dashboard/:orgId | unit (mock) | same file | Wave 0 |
| AUTH-HW-05 | Member gets 403 on GET /credit-compliance/:orgId | unit (mock) | same file | Wave 0 |
| AUTH-HW-06 | Officer gets 200 on all officer endpoints | unit (mock) | same file | Wave 0 |
| AUTH-ASSN-01 | Member gets 403 on POST /association/events | unit (handler) | `bun test src/tests/route-protection-association.test.ts` | Wave 0 |
| AUTH-ASSN-02 | Member gets 403 on ~17 more mutation routes | unit (handler) | same file | Wave 0 |
| AUTH-IDOR-01 | Officer of Org A blocked from Org B roster | integration | `bun test src/tests/route-protection-idor.test.ts` | Wave 0 |
| AUTH-IDOR-02 | Officer of Org A blocked from Org B dues | integration | same file | Wave 0 |
| AUTH-IDOR-03 | Officer of Org A blocked from creating event in Org B | integration | same file | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd services/api-ts && bun test src/tests/route-protection`
- **Per wave merge:** `cd services/api-ts && bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `services/api-ts/src/tests/route-protection-handwired.test.ts` -- hand-wired route auth tests
- [ ] `services/api-ts/src/tests/route-protection-association.test.ts` -- generated route auth tests
- [ ] `services/api-ts/src/tests/route-protection-idor.test.ts` -- cross-org isolation tests
- [ ] Second org seed data in `seed.ts` (D-03/D-04)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Already handled by `authMiddleware()` |
| V3 Session Management | no | Already handled by Better-Auth |
| V4 Access Control | **yes** | `officerAuthMiddleware()` + `requireOrgRole()` |
| V5 Input Validation | no | Not in scope for this phase |
| V6 Cryptography | no | Not in scope |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation (member accessing officer endpoints) | Elevation of Privilege | `officerAuthMiddleware()` on hand-wired routes; `requireOrgRole()` on handlers |
| IDOR (officer accessing other org's data) | Information Disclosure / Tampering | `orgContextMiddleware` validates membership; `requireTenantAccess()` compares orgIds |
| Bypassing middleware via direct handler call | Elevation of Privilege | Tests verify at HTTP level, not handler level |
| Officer term expiry bypass | Elevation of Privilege | `officerAuthMiddleware` queries `officer_term` for active terms only |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Module routers (dues/index.ts, membership/index.ts) are dead code -- not mounted in app.ts | Architecture Patterns | If they ARE mounted somewhere, adding officerAuth to app.ts inline routes would double-protect |
| A2 | `requireOrgRole` with `orgMembership.role='member'` (set by orgContextMiddleware) will correctly deny members | Pitfall 2 | If officer status is needed from officer_term, requireOrgRole alone won't work -- need to query officer_term in handler |

**A2 is critical:** The `orgContextMiddleware` always sets `role: 'member'`. For `/association/*` handler-level checks, `requireOrgRole()` checks against this role. If the allowed roles list includes only officer roles (president, treasurer, etc.), members will be correctly denied. But officers will ALSO be denied because their context role is 'member'. Handler-level officer checks likely need to query `officer_term` directly, not rely on `orgMembership.role`. This must be verified during implementation.

## Open Questions

1. **How do /association/* handlers currently check officer status?**
   - What we know: `orgContextMiddleware` sets `role: 'member'` for all. `requireOrgRole` checks this role.
   - What's unclear: Do any existing handlers already query `officer_term`? Or is `requireOrgRole` meant to work with a role that's never set to officer values?
   - Recommendation: During RED phase, write tests that verify officer gets 200 on mutation routes. If tests fail (officer also gets 403), the handler-level check needs to query `officer_term` instead of relying on `requireOrgRole`.

2. **Should hand-wired inline routes be refactored to use module routers?**
   - What we know: Module routers exist with proper `officerAuth`. But they're not mounted.
   - What's unclear: Whether refactoring to mount them would simplify this phase.
   - Recommendation: Per D-05, do NOT refactor. Just add `officerAuthMiddleware()` to inline routes. Refactoring is a separate concern.

## Sources

### Primary (HIGH confidence)
- `services/api-ts/src/app.ts` -- Inline route definitions, middleware chain, actual route registration
- `services/api-ts/src/middleware/officer-auth.ts` -- officerAuthMiddleware implementation
- `services/api-ts/src/middleware/org-context.ts` -- orgContextMiddleware, always sets role='member'
- `services/api-ts/src/utils/org-auth.ts` -- requireOrgRole, requireTenantAccess implementations
- `services/api-ts/src/middleware/custom-routes-auth.test.ts` -- Test pattern to follow
- `services/api-ts/src/handlers/dues/index.ts` -- Module router with officerAuth (not mounted)
- `services/api-ts/src/handlers/membership/index.ts` -- Module router with officerAuth (not mounted)
- `services/api-ts/src/tests/helpers/api-as.ts` -- Integration test helper
- `docs/TDD-AUTH-PLAN.md` -- Full TDD plan with endpoint lists

### Secondary (MEDIUM confidence)
- `services/api-ts/src/handlers/bug-class/auth-matrix.test.ts` -- RBAC utility test pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already exist in codebase, no new dependencies
- Architecture: HIGH -- clear separation between hand-wired (middleware) and generated (handler-level)
- Pitfalls: HIGH -- identified from direct code inspection of orgContextMiddleware role='member' gap

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stable -- internal codebase patterns)
