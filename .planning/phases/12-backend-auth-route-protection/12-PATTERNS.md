# Phase 12: Backend Auth -- Route Protection - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 6 (3 new test files, 2 modified source files, 1 modified seed file)
**Analogs found:** 5 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/api-ts/src/tests/route-protection-handwired.test.ts` | test | request-response | `services/api-ts/src/middleware/custom-routes-auth.test.ts` | exact |
| `services/api-ts/src/tests/route-protection-association.test.ts` | test | request-response | `services/api-ts/src/handlers/bug-class/auth-matrix.test.ts` | role-match |
| `services/api-ts/src/tests/route-protection-idor.test.ts` | test | request-response | `services/api-ts/src/tests/helpers/api-as.ts` (consumer pattern) | role-match |
| `services/api-ts/src/app.ts` | route-config | request-response | self (existing inline routes at lines 270-410) | exact |
| `services/api-ts/src/handlers/*/` (mutation handlers) | handler | request-response | `services/api-ts/src/utils/org-auth.ts` (consumer pattern) | exact |
| `services/api-ts/src/seed.ts` | config | batch | self (existing seed pattern) | exact |

## Pattern Assignments

### `route-protection-handwired.test.ts` (test, request-response)

**Analog:** `services/api-ts/src/middleware/custom-routes-auth.test.ts`

This is the PRIMARY analog. The new file extends the same pattern to test officer-level protection (403) instead of just auth protection (401).

**Imports pattern** (lines 1-3):
```typescript
import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { authMiddleware } from '@/middleware/auth';
```

**Mock app factory pattern** (lines 25-68):
```typescript
function makeProtectedApp() {
  const app = new Hono();

  // Mock the dependency injection middleware - set auth but NO session
  app.use('*', async (ctx, next) => {
    ctx.set('auth', {
      api: {
        getSession: async () => null, // No session = unauthenticated
      },
    });
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    await next();
  });

  // Auth middleware on all custom module routes (mirrors app.ts)
  app.use('/dues/*', authMiddleware());
  app.use('/membership/*', authMiddleware());
  // ... more routes

  // Register dummy handlers (we never reach these if auth works)
  const dummyHandler = (ctx: any) => ctx.json({ ok: true });
  app.get('/dues/config/:orgId', dummyHandler);
  // ... more dummy handlers

  // Error handler to convert thrown errors to JSON responses
  app.onError((err, ctx) => {
    if (err.message === 'Authentication required') {
      return ctx.json({ error: err.message }, 401);
    }
    return ctx.json({ error: err.message }, 500);
  });

  return app;
}
```

**Data-driven test loop pattern** (lines 70-93):
```typescript
describe('Custom module routes auth protection', () => {
  const app = makeProtectedApp();

  const protectedRoutes = [
    { method: 'GET', path: '/dues/config/org-1', module: 'dues' },
    { method: 'POST', path: '/dues/payments', module: 'dues' },
    // ... more routes
  ];

  for (const route of protectedRoutes) {
    test(`${route.module}: ${route.method} ${route.path} returns 401 without auth`, async () => {
      const req = new Request(`http://localhost${route.path}`, {
        method: route.method,
      });
      const res = await app.request(req);
      expect(res.status).toBe(401);
    });
  }
});
```

**New file adaptation notes:**
- Extend `makeProtectedApp()` to create TWO app variants: one with member session (authenticated but not officer), one with officer session
- Add `officerAuthMiddleware()` import and wire it alongside `authMiddleware()` in the mock app
- Member mock needs: `ctx.set('user', {...})` and `ctx.set('database', ...)` with mocked `OfficerTermRepository` returning empty array
- Officer mock needs: same but `OfficerTermRepository` returning active term
- Error handler must also catch `'Officer access'` / `'Forbidden'` messages and return 403

---

### `route-protection-association.test.ts` (test, request-response)

**Analog:** `services/api-ts/src/handlers/bug-class/auth-matrix.test.ts`

Uses `makeCtx()` factory for handler-level testing of `requireOrgRole()` checks.

**Imports pattern** (lines 1-4):
```typescript
import { describe, test, expect } from 'bun:test';
import {
  requireOrgRole,
} from '@/utils/org-auth';
import { makeCtx } from '@/test-utils/make-ctx';
```

**Context factory with membership pattern** (lines 22-27):
```typescript
function ctxWithMembership(role: string, status: string = 'active', orgId: string = 'org-1') {
  return makeCtx({
    orgId,
    orgMembership: { role, status, orgId },
  });
}
```

**Role denial assertion pattern** (lines 46-51):
```typescript
test('denies role not in allowed list', () => {
  const ctx = ctxWithMembership('member');
  const result = requireOrgRole(ctx, ['president', 'treasurer']);
  expect(result).not.toBeNull();
  expect(result!.status).toBe(403);
});
```

**New file adaptation notes:**
- Per RESEARCH.md Pitfall 2: `orgContextMiddleware` always sets `role: 'member'`. So `requireOrgRole()` alone will deny officers too.
- Handler-level officer checks for `/association/*` mutations may need to query `officer_term` directly instead of relying on `orgMembership.role`
- Test should verify: member gets 403 on mutation handlers, officer gets 200 (or at least not 403 from role check)
- Use `test.each` pattern from auth-matrix.test.ts lines 60-64 for iterating over multiple mutation endpoints

---

### `route-protection-idor.test.ts` (test, request-response)

**Analog:** `services/api-ts/src/tests/helpers/api-as.ts` (consumer pattern)

Integration tests using real HTTP client with session cookies. Requires running API server + seeded DB.

**apiAs helper interface** (lines 13-20):
```typescript
export interface ApiClient {
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown) => Promise<Response>;
  put: (path: string, body?: unknown) => Promise<Response>;
  patch: (path: string, body?: unknown) => Promise<Response>;
  delete: (path: string) => Promise<Response>;
  cookie: string;
}
```

**Usage pattern** (from RESEARCH.md Pattern 5):
```typescript
import { apiAs } from '@/tests/helpers/api-as';

test('officer of Org A cannot access Org B roster', async () => {
  const orgAOfficer = await apiAs('treasurer@memberry.ph');
  const res = await orgAOfficer.get(`/membership/members/${ORG_B_ID}`);
  expect(res.status).toBe(403);
});
```

**New file adaptation notes:**
- Requires second org seeded (D-03/D-04) with known org ID
- Test org IDs should be imported from seed constants or queried at test setup
- Test both directions: Org A officer -> Org B data (403), and Org B officer -> Org A data (403)

---

### `app.ts` modification (route-config, request-response)

**Analog:** Self -- existing pattern at lines 270-410

**Current pattern** (lines 271, 312, 321, etc.):
```typescript
// Current: authMiddleware only
app.get('/credit-compliance/:orgId', authMiddleware(), async (ctx) => { ... });
app.get('/membership/org-profile/:orgId', authMiddleware(), async (ctx) => { ... });
app.put('/membership/org-profile/:orgId', authMiddleware(), async (ctx) => { ... });
app.get('/membership/members/:orgId', authMiddleware(), async (ctx) => { ... });
app.get('/membership/applications/:orgId', authMiddleware(), async (ctx) => { ... });
app.get('/dues/dashboard/:orgId', authMiddleware(), async (ctx) => { ... });
```

**Target pattern** (from D-05, mirrors platformAdminAuthMiddleware usage):
```typescript
// Target: authMiddleware + officerAuthMiddleware
app.get('/credit-compliance/:orgId', authMiddleware(), officerAuthMiddleware(), async (ctx) => { ... });
app.put('/membership/org-profile/:orgId', authMiddleware(), officerAuthMiddleware(), async (ctx) => { ... });
app.get('/membership/members/:orgId', authMiddleware(), officerAuthMiddleware(), async (ctx) => { ... });
```

**Import to add** (officer-auth.ts line 14):
```typescript
import { officerAuthMiddleware } from '@/middleware/officer-auth';
```

**Per D-07:** GET routes that members should still access (view events, view own memberships) do NOT get `officerAuthMiddleware()`. Only officer-dashboard and mutation routes.

---

### Mutation handler modifications (handler, request-response)

**Analog:** `services/api-ts/src/utils/org-auth.ts` lines 28-45

**requireOrgRole guard pattern:**
```typescript
import { requireOrgRole } from '@/utils/org-auth';

export async function createEvent(ctx: BaseContext) {
  const denied = requireOrgRole(ctx, ['president', 'vice-president', 'secretary', 'officer']);
  if (denied) return denied;
  // ... handler logic
}
```

**CRITICAL per Pitfall 2:** `orgContextMiddleware` always sets `role: 'member'`. `requireOrgRole()` checks `orgMembership.role` which will be `'member'` for everyone. Officers will also be denied. Handler-level checks may need to query `officer_term` directly. Verify during RED phase.

---

### `seed.ts` modification (config, batch)

**Analog:** Self -- existing org/user creation pattern at lines 157+

**Existing org reference pattern** (seed-rich.ts lines 62-64):
```typescript
const [org1] = await db.select().from(organizations).where(eq(organizations.slug, 'pda-metro-manila')).limit(1);
const [org2] = await db.select().from(organizations).where(eq(organizations.slug, 'pda-cebu')).limit(1);
```

**Officer term seeding** -- uses `officerTerms` table from governance schema:
```typescript
import { positions, officerTerms } from './handlers/association:member/repos/governance.schema';
```

**New seed data needed (D-03/D-04):**
- Second org with distinct slug (e.g., `pda-cebu` may already exist from seed-rich.ts)
- At least one user signed up and associated with second org
- Active `officer_term` record for that user in second org
- Follow existing `signUpUser()` + `createPerson()` + direct DB insert pattern from seed.ts

## Shared Patterns

### Authentication Middleware Chain
**Source:** `services/api-ts/src/middleware/auth.ts` + `services/api-ts/src/middleware/officer-auth.ts`
**Apply to:** All hand-wired routes in `app.ts` that are officer-only

Sequential middleware: `authMiddleware()` first (sets user/session), then `officerAuthMiddleware()` (checks officer_term for `:orgId`).

### ForbiddenError Throw Pattern
**Source:** `services/api-ts/src/core/errors.ts` lines 30-34
**Apply to:** All middleware-level auth checks (officer-auth.ts pattern)
```typescript
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}
```

Middleware throws `ForbiddenError`, `app.onError` (via `createErrorHandler`) catches and returns JSON 403.

### requireOrgRole Return Pattern
**Source:** `services/api-ts/src/utils/org-auth.ts` lines 28-45
**Apply to:** All handler-level auth checks in generated `/association/*` mutation handlers
```typescript
export function requireOrgRole(
  ctx: BaseContext,
  allowedRoles: readonly string[]
): Response | null {
  const membership = ctx.get('orgMembership');
  if (!membership) {
    return ctx.json({ error: 'Organization membership required' }, 403);
  }
  if (!allowedRoles.includes(membership.role)) {
    return ctx.json({ error: `Requires one of: ${allowedRoles.join(', ')}` }, 403);
  }
  return null;
}
```

Returns 403 Response (NOT thrown). Different from middleware pattern. Per D-09, do not mix styles within a handler.

### Test Mock App Pattern
**Source:** `services/api-ts/src/middleware/custom-routes-auth.test.ts` lines 25-68
**Apply to:** `route-protection-handwired.test.ts`

Lightweight Hono app with mocked dependencies. No DB needed. Tests at HTTP level via `app.request()`.

### Test Context Factory Pattern
**Source:** `services/api-ts/src/test-utils/make-ctx.ts` lines 43-84
**Apply to:** `route-protection-association.test.ts`

`makeCtx()` creates mock handler context with `get()`, `set()`, `req.param()`, `json()` methods. Use `orgMembership` override for role testing.

### Integration Test Client Pattern
**Source:** `services/api-ts/src/tests/helpers/api-as.ts` lines 22-61
**Apply to:** `route-protection-idor.test.ts`

`apiAs(email)` signs in via real Better-Auth, returns client with cookie auto-attached. Needs running API server + seeded users.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have close analogs in the codebase |

## Metadata

**Analog search scope:** `services/api-ts/src/`
**Files scanned:** 8 analog files read
**Pattern extraction date:** 2026-05-08
