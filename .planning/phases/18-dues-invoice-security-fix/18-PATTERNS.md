# Phase 18: Dues Invoice Security Fix - Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 16 (11 handlers to modify + 5 new test files)
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `handlers/association:member/markDuesInvoicePaid.ts` | handler | request-response | `handlers/association:member/recordDuesPayment.ts` | exact |
| `handlers/association:member/updateDuesInvoice.ts` | handler | request-response | `handlers/association:member/recordDuesPayment.ts` | exact |
| `handlers/association:member/deleteDuesInvoice.ts` | handler | request-response | `handlers/association:member/recordDuesPayment.ts` | exact |
| `handlers/association:member/createDuesInvoice.ts` | handler | request-response | `handlers/association:member/recordDuesPayment.ts` | exact |
| `handlers/association:member/generateDuesInvoicesForOrg.ts` | handler | request-response | `handlers/association:member/recordDuesPayment.ts` | role-match (already has requirePosition, needs org-scope) |
| `handlers/association:member/listDuesInvoices.ts` | handler | request-response | `handlers/dues/getDuesDashboard.ts` | role-match |
| `handlers/association:member/getDuesInvoice.ts` | handler | request-response | `handlers/association:member/getDuesPayment.ts` | exact |
| `handlers/association:member/listDuesPayments.ts` | handler | request-response | `handlers/dues/getDuesDashboard.ts` | role-match |
| `handlers/association:member/getDuesPayment.ts` | handler | request-response | `handlers/association:member/getDuesInvoice.ts` | exact |
| `handlers/association:member/getDuesFinancialDashboard.ts` | handler | request-response | `handlers/dues/getDuesDashboard.ts` | exact |
| `handlers/association:member/generateDuesReport.ts` | handler | request-response | `handlers/dues/getDuesDashboard.ts` | exact |
| `handlers/association:member/markDuesInvoicePaid.test.ts` | test | request-response | `handlers/dues/getDuesDashboard.test.ts` | exact |
| `handlers/association:member/getDuesInvoice.test.ts` | test | request-response | `handlers/dues/getDuesDashboard.test.ts` | exact |
| `handlers/association:member/getDuesPayment.test.ts` | test | request-response | `handlers/dues/getDuesDashboard.test.ts` | exact |
| `handlers/association:member/listDuesPayments.test.ts` | test | request-response | `handlers/dues/getDuesDashboard.test.ts` | exact |
| `handlers/association:member/getDuesFinancialDashboard.test.ts` | test | request-response | `handlers/dues/getDuesDashboard.test.ts` | exact |

---

## Pattern Assignments

### Mutation Handlers: `markDuesInvoicePaid.ts`, `updateDuesInvoice.ts`, `deleteDuesInvoice.ts`, `createDuesInvoice.ts`

**Analog:** `services/api-ts/src/handlers/association:member/recordDuesPayment.ts`

**Current state of each file (what to replace):**
- `markDuesInvoicePaid.ts` (lines 1-4): Missing `requirePosition` import; session is first guard, no cross-org check after invoice fetch
- `updateDuesInvoice.ts` (lines 1-4): Missing `requirePosition` import; no cross-org check after `findOneById`
- `deleteDuesInvoice.ts` (lines 1-4): Missing `requirePosition` import; no cross-org check after `findOneById`
- `createDuesInvoice.ts` (lines 17-22): Uses `ctx.get('user')` pattern + manual 403, not `requirePosition`; no cross-org body param verification

**Imports to add** (from `recordDuesPayment.ts` lines 9-10):
```typescript
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
```

**Also add `ForbiddenError` to existing error imports** (from `core/errors.ts` lines 30-33):
```typescript
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
```

**Core mutation guard pattern** (from `recordDuesPayment.ts` lines 24-31):
```typescript
// TOP of handler — before any business logic
const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
if (denied) return denied;

const session = ctx.get('session');
if (!session) throw new UnauthorizedError();

const orgId = ctx.get('organizationId') as string;
```

**Cross-org isolation after fetch** (apply after every `findOneById` call):
```typescript
// After: const invoice = await repo.findOneById(invoiceId);
// After: if (!invoice) throw new NotFoundError('DuesInvoice');
if (invoice.organizationId !== orgId) throw new ForbiddenError();
```

**Full before/after for `markDuesInvoicePaid.ts`:**

Before (lines 21-32):
```typescript
export async function markDuesInvoicePaid(...): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const invoiceRepo = new DuesInvoiceRepository(db, logger);

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');
  // ← no cross-org check here
```

After:
```typescript
export async function markDuesInvoicePaid(...): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const orgId = ctx.get('organizationId') as string;
  const invoiceRepo = new DuesInvoiceRepository(db, logger);

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');
  if (invoice.organizationId !== orgId) throw new ForbiddenError();
```

---

### `generateDuesInvoicesForOrg.ts` (mutation handler, already has `requirePosition`)

**Analog:** `services/api-ts/src/handlers/association:member/recordDuesPayment.ts`

**Current state:** Already has `requirePosition` at line 26. Gap: uses `body.organizationId` (client-supplied) instead of `ctx.get('organizationId')`.

**Fix:** After requirePosition + session check, enforce org from context:
```typescript
// Replace: const body = ctx.req.valid('json');
// Then use body.organizationId in DB calls

// With:
const body = ctx.req.valid('json');
const orgId = ctx.get('organizationId') as string;

// Then verify client-supplied org matches caller's org:
if (body.organizationId !== orgId) throw new ForbiddenError();

// And use orgId (not body.organizationId) for all subsequent DB calls
```

**Imports to add** (not present in current file):
```typescript
import { ForbiddenError } from '@/core/errors';
```

---

### `listDuesInvoices.ts` (read handler, org-scope guard)

**Analog:** `services/api-ts/src/handlers/dues/getDuesDashboard.ts`

**Current state (lines 19):** `const orgId = ctx.get('organizationId');` — correct source, but no explicit 403 if null.

**Fix (lines 19-20, insert after `const orgId = ...`):**
```typescript
const orgId = ctx.get('organizationId');
if (!orgId) throw new ForbiddenError(); // belt-and-suspenders: middleware should have set this
```

**Imports to add:**
```typescript
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
```

No position check needed — list endpoint is org-membership-scoped, per CONTEXT.md "Query/read endpoints enforce org membership."

---

### `getDuesInvoice.ts` (read handler, cross-org isolation)

**Analog:** `services/api-ts/src/handlers/association:member/getDuesPayment.ts` (same structure, same gap)

**Current state (lines 13-27):** Fetches invoice by ID and returns it. No org verification.

**Fix — full handler after:**
```typescript
export async function getDuesInvoice(
  ctx: ValidatedContext<never, never, GetDuesInvoiceParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) throw new ForbiddenError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesInvoiceRepository(db, ctx.get('logger'));

  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('DuesInvoice');

  // Cross-org isolation: reject if invoice belongs to a different org
  if (invoice.organizationId !== orgId) throw new ForbiddenError();

  return ctx.json(invoice, 200);
}
```

**Imports to add:**
```typescript
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
```

---

### `listDuesPayments.ts` (read handler, org param enforcement)

**Analog:** `services/api-ts/src/handlers/association:member/listDuesInvoices.ts` (same pattern after fix)

**Current state (lines 28-34):** Passes `query.organizationId` directly to repo — security hole.

**Fix — replace lines 19-34:**
```typescript
const query = ctx.req.valid('query');
const db = ctx.get('database') as DatabaseInstance;
const repo = new DuesRepository(db);

// SEC-02: Always use middleware-set orgId, never client-supplied query param
const orgId = ctx.get('organizationId');
if (!orgId) throw new ForbiddenError();

const page = query.page ?? 1;
const pageSize = query.pageSize ?? 20;
const offset = query.offset ?? (page - 1) * pageSize;
const limit = query.limit ?? pageSize;

const result = await repo.listPayments({
  organizationId: orgId, // ← was: query.organizationId
  personId: query.personId,
  status: query.status,
  limit,
  offset,
});
```

**Imports to add:**
```typescript
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
```

---

### `getDuesPayment.ts` (read handler, cross-org isolation)

**Analog:** `services/api-ts/src/handlers/association:member/getDuesInvoice.ts` (mirror pattern)

**Current state (lines 13-27):** Fetches payment by ID, no org check.

**Fix — full handler after:**
```typescript
export async function getDuesPayment(
  ctx: ValidatedContext<never, never, GetDuesPaymentParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) throw new ForbiddenError();

  const { paymentId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(paymentId);
  if (!payment) throw new NotFoundError('Dues payment');

  // Cross-org isolation: reject if payment belongs to a different org
  if (payment.organizationId !== orgId) throw new ForbiddenError();

  return ctx.json(payment, 200);
}
```

**Imports to add:**
```typescript
import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
```

---

### `getDuesFinancialDashboard.ts` (read + officer, route param org check)

**Analog:** `services/api-ts/src/handlers/dues/getDuesDashboard.ts`

**Current state (lines 13-39):** Uses `organizationId` from route param directly, no position check, no cross-org verification.

**Fix — full handler after:**
```typescript
export async function getDuesFinancialDashboard(
  ctx: ValidatedContext<never, never, GetDuesFinancialDashboardParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');

  // Verify route param matches caller's org from middleware
  const ctxOrgId = ctx.get('organizationId');
  if (ctxOrgId && organizationId !== ctxOrgId) throw new ForbiddenError();

  // Set org on context so requirePosition can look up officer terms for the right org
  ctx.set('organizationId', organizationId);
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const stats = await repo.getDashboardStats(organizationId);
  const gatewayConfig = await repo.getGatewayConfig(organizationId);

  return ctx.json({
    totalCollected: Number(stats.totalCollected),
    totalOutstanding: Number(stats.totalOutstanding),
    pendingCount: Number(stats.pendingCount),
    completedCount: Number(stats.completedCount),
    totalCount: Number(stats.totalCount),
    collectionRate: Number(stats.collectionRate),
    gatewayConfigured: !!gatewayConfig?.connected,
    expiringThisMonth: 0,
  }, 200);
}
```

**Imports to add:**
```typescript
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
```

---

### `generateDuesReport.ts` (read + officer, route param org check)

**Analog:** `services/api-ts/src/handlers/dues/getDuesDashboard.ts` (same route-param org pattern as `getDuesFinancialDashboard`)

**Fix — insert after session check, before repo calls:**
```typescript
const session = ctx.get('session');
if (!session) throw new UnauthorizedError();

const { organizationId } = ctx.req.valid('param');

// Verify route param matches caller's org
const ctxOrgId = ctx.get('organizationId');
if (ctxOrgId && organizationId !== ctxOrgId) throw new ForbiddenError();

// Position check: financial reports are officer-only
ctx.set('organizationId', organizationId);
const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
if (denied) return denied;
```

**Imports to add:**
```typescript
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
```

---

### Test Files (all 5 new)

**Analog:** `services/api-ts/src/handlers/dues/getDuesDashboard.test.ts`

**Test file imports pattern** (lines 1-7):
```typescript
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { mock } from 'bun:test';
import { SomeRepository } from './repos/dues.repo';
import { handlerUnderTest } from './handlerUnderTest';
```

**requirePosition mock — allowed** (from `getDuesDashboard.test.ts` lines 39-41):
```typescript
mock.module('@/utils/officer-check', () => ({
  requirePosition: async () => null, // null = allowed
}));
```

**requirePosition mock — denied** (derived from same file):
```typescript
mock.module('@/utils/officer-check', () => ({
  requirePosition: async (_ctx: any) => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
}));
```

**makeCtx pattern — with session and orgId** (from `getDuesDashboard.test.ts` lines 44-52):
```typescript
const ctx = makeCtx({
  _params: { invoiceId: 'inv-1' },
  session: { user: { id: 'user-1' } },
  user: { id: 'user-1' },
  organizationId: 'org-1',
  database: { /* stub methods */ },
});
```

**makeCtx pattern — no session (401 test)** (from `getDuesDashboard.test.ts` lines 26-30):
```typescript
const ctx = makeCtx({
  _params: { invoiceId: 'inv-1' },
  session: null,
  user: null,
});
await expect(handler(ctx as any)).rejects.toThrow();
```

**Required test scenarios per new test file:**

`markDuesInvoicePaid.test.ts`:
1. 401 when no session
2. 403 when `requirePosition` denies (member role)
3. 403 when invoice belongs to different org (`invoice.organizationId !== orgId`)
4. 200 when officer of correct org marks paid (regression — existing flow)

`getDuesInvoice.test.ts`:
1. 401 when no session
2. 404 when invoice not found
3. 403 when invoice.organizationId !== ctx orgId (cross-org read)
4. 200 when invoice belongs to caller's org

`getDuesPayment.test.ts`:
1. 401 when no session
2. 404 when payment not found
3. 403 when payment.organizationId !== ctx orgId
4. 200 when payment belongs to caller's org

`listDuesPayments.test.ts`:
1. 401 when no session
2. 403 when orgId is null in context
3. Verify repo is called with ctx orgId, NOT `query.organizationId` (stub assertion)
4. 200 with correct data when org matches

`getDuesFinancialDashboard.test.ts`:
1. 401 when no session
2. 403 when `requirePosition` denies
3. 403 when route param orgId !== ctx orgId
4. 200 when officer of correct org requests dashboard

---

## Shared Patterns

### Position Guard (Mutation Handlers)
**Source:** `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` lines 24-31
**Apply to:** `markDuesInvoicePaid`, `updateDuesInvoice`, `deleteDuesInvoice`, `createDuesInvoice`
```typescript
const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
if (denied) return denied;

const session = ctx.get('session');
if (!session) throw new UnauthorizedError();

const orgId = ctx.get('organizationId') as string;
```

### Cross-Org Isolation After Fetch
**Source:** Derived from `getDuesDashboard.ts` (org-scope) + `ForbiddenError` from `core/errors.ts`
**Apply to:** `markDuesInvoicePaid`, `updateDuesInvoice`, `deleteDuesInvoice`, `getDuesInvoice`, `getDuesPayment`
```typescript
// After fetching resource by ID:
if (resource.organizationId !== orgId) throw new ForbiddenError();
```

### ForbiddenError (Generic, No Info Leakage)
**Source:** `services/api-ts/src/core/errors.ts` lines 30-33
**Apply to:** All handler files in this phase
```typescript
// ForbiddenError defaults to message='Forbidden', code='FORBIDDEN', status=403
throw new ForbiddenError(); // No message arg — keeps reason opaque
```

### Org Context from Middleware (Never from Client Params)
**Source:** `services/api-ts/src/handlers/association:member/listDuesInvoices.ts` line 19
**Apply to:** `listDuesInvoices`, `listDuesPayments`
```typescript
const orgId = ctx.get('organizationId'); // Always from middleware, never query/body
if (!orgId) throw new ForbiddenError();
```

### Route Param Org Verification (Dashboard/Report Handlers)
**Source:** `services/api-ts/src/handlers/dues/getDuesDashboard.ts` lines 31-35
**Apply to:** `getDuesFinancialDashboard`, `generateDuesReport`
```typescript
const { organizationId } = ctx.req.valid('param');
const ctxOrgId = ctx.get('organizationId');
if (ctxOrgId && organizationId !== ctxOrgId) throw new ForbiddenError();
// Then set on ctx before requirePosition:
ctx.set('organizationId', organizationId);
const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
if (denied) return denied;
```

### Audit Logging (Mutation Handlers)
**Source:** `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` lines 87-92
**Apply to:** All mutation handlers (already present in most; verify not removed)
```typescript
await auditAction(ctx, {
  action: 'mark-paid', // or 'update', 'delete', 'create'
  resourceType: 'dues-invoice',
  resourceId: invoiceId,
  description: 'Human-readable description',
});
```

---

## No Analog Found

None — all 16 files have close or exact analogs in the codebase.

---

## Key Observations

1. **`generateDuesInvoicesForOrg.ts` already has `requirePosition`** (lines 26-27) — it only needs the `body.organizationId` vs `ctx.get('organizationId')` cross-org check added.

2. **`createDuesInvoice.ts` uses `ctx.get('user')` pattern** (line 17) instead of session — replace with `requirePosition` + session pattern from `recordDuesPayment.ts`.

3. **`getDuesDashboard.ts` (under `/dues/`) manually calls `ctx.set('organizationId', orgId)` before `requirePosition`** because it is NOT under `/association/*` (no `orgContextMiddleware`). The affected handlers ARE under `/association/*` so `organizationId` is already set by middleware — do NOT re-set it for most handlers. Exception: `getDuesFinancialDashboard` and `generateDuesReport` use route params and need explicit `ctx.set('organizationId', organizationId)` before `requirePosition` to ensure the correct org is used.

4. **`requirePosition` returns a Response or null** — callers must do `if (denied) return denied;` not `throw denied`.

5. **`requirePosition` error messages reveal the required position titles** (line 93 of `officer-check.ts`). This is the existing codebase behavior — do not change `requirePosition` itself.

---

## Metadata

**Analog search scope:** `services/api-ts/src/handlers/association:member/`, `services/api-ts/src/handlers/dues/`, `services/api-ts/src/utils/`, `services/api-ts/src/core/`
**Files scanned:** 16 source files, 1 test file
**Pattern extraction date:** 2026-05-13
