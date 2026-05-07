# Phase 1: Billing Schema Completion - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 6 (3 handler modifications, 3 new test files)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/api-ts/src/handlers/billing/listInvoices.ts` | handler | request-response | `services/api-ts/src/handlers/billing/voidInvoice.ts` | exact |
| `services/api-ts/src/handlers/billing/getInvoice.ts` | handler | request-response | `services/api-ts/src/handlers/billing/voidInvoice.ts` | exact |
| `services/api-ts/src/handlers/billing/finalizeInvoice.ts` | handler | request-response | `services/api-ts/src/handlers/billing/voidInvoice.ts` | exact |
| `services/api-ts/src/handlers/billing/listInvoices.test.ts` | test | request-response | `services/api-ts/src/handlers/billing/createInvoice.test.ts` | exact |
| `services/api-ts/src/handlers/billing/accessControl.test.ts` | test | request-response | `services/api-ts/src/handlers/billing/createInvoice.test.ts` | exact |
| `services/api-ts/src/handlers/billing/lifecycle.test.ts` | test | request-response | `services/api-ts/src/handlers/billing/createInvoice.test.ts` | exact |

## Pattern Assignments

### `listInvoices.ts` / `getInvoice.ts` / `finalizeInvoice.ts` (handler modifications)

**Analog:** `services/api-ts/src/handlers/billing/voidInvoice.ts`

**Imports pattern** (lines 1-12):
```typescript
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError,
  ConflictError
} from '@/core/errors';
import type { ValidatedContext } from '@/types/app';
import type { Session } from '@/types/auth';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
```

**Admin role check pattern** (voidInvoice.ts lines 55-71):
```typescript
const user = session.user;
const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
const isAdmin = userRoles.includes('admin');

if (!isAdmin) {
  // For non-admins, check if user is the merchant on the invoice
  if (user.id !== invoice.merchant) {
    throw new ForbiddenError('You can only void your own invoices');
  }
}
```

**Customer-scoped read pattern** (for getInvoice/listInvoices — adapt from voidInvoice admin check):
```typescript
// Non-admin users can only see invoices where they are customer or merchant
const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
const isAdmin = userRoles.includes('admin');

if (!isAdmin) {
  if (invoice.merchant !== user.id && invoice.customer !== user.id) {
    throw new ForbiddenError('You can only access invoices where you are the merchant or customer');
  }
}
```

**Response field mapping pattern** (replace TODO hardcodes — fields exist in schema):
```typescript
const response = {
  id: invoice.id,
  invoiceNumber: invoice.invoiceNumber,
  customer: invoice.customer,
  merchant: invoice.merchant,
  context: invoice.context || null,
  status: invoice.status,
  subtotal: invoice.subtotal,
  tax: invoice.tax || null,
  total: invoice.total,
  currency: invoice.currency,
  paymentCaptureMethod: invoice.paymentCaptureMethod,
  paymentDueAt: invoice.paymentDueAt?.toISOString() || null,
  lineItems: (lineItems || []).map(item => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount,
    metadata: item.metadata || null
  })),
  paymentStatus: invoice.paymentStatus || null,
  paidAt: invoice.paidAt?.toISOString() || null,
  paidBy: invoice.paidBy || null,
  voidedAt: invoice.voidedAt?.toISOString() || null,
  voidedBy: invoice.voidedBy || null,
  voidThresholdMinutes: invoice.voidThresholdMinutes || null,
  authorizedAt: invoice.authorizedAt?.toISOString() || null,
  authorizedBy: invoice.authorizedBy || null,
  metadata: invoice.metadata || null,
  createdAt: invoice.createdAt.toISOString(),
  updatedAt: invoice.updatedAt.toISOString()
};
```

**Line items fetch pattern** (billing.repo.ts lines 74-94):
```typescript
// Single invoice — use existing repo method
async findOneWithLineItems(id: string): Promise<InvoiceWithLineItems | null> {
  const invoice = await this.findOneById(id);
  if (!invoice) return null;

  const lineItems = await this.db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoice, id));

  return { ...invoice, lineItems };
}
```

**List endpoint customer-scoped filter pattern** (for listInvoices — add to filters):
```typescript
// For non-admin users, force customer/merchant filter
if (!isAdmin) {
  // User can only see invoices where they are customer or merchant
  // Add OR condition: customer = user.id OR merchant = user.id
  filters.customer = user.id; // Simplification: or use SQL or() for both
}
```

---

### `createInvoice.test.ts` pattern (for all new test files)

**Analog:** `services/api-ts/src/handlers/billing/createInvoice.test.ts`

**Test file structure** (lines 1-11):
```typescript
import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
```

**Fixture pattern** (lines 17-83):
```typescript
const MERCHANT_ID = 'merch-uuid-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'cust-uuid-2222-2222-2222-222222222222';
const INVOICE_ID = 'inv-uuid-3333-3333-3333-333333333333';

function makeSession(userId = MERCHANT_ID) {
  return {
    user: { id: userId, email: 'test@test.com', name: 'Test User' },
    session: { id: 'session-id', userId },
  };
}

function makeCreatedInvoice(overrides?: Record<string, any>) {
  const base = {
    id: INVOICE_ID,
    invoiceNumber: 'INV-2026-000001',
    customer: CUSTOMER_ID,
    merchant: MERCHANT_ID,
    // ... all fields with defaults ...
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    lineItems: [{ id: 'li-001', invoice: INVOICE_ID, description: 'Service fee', quantity: 1, unitPrice: 10000, amount: 10000, metadata: null }],
  };
  return { ...base, ...(overrides ?? {}) };
}
```

**Error handler pattern** (lines 97-104):
```typescript
function attachErrorHandler(app: Hono) {
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ code: err.code, message: err.message }, err.statusCode as any);
    }
    return c.json({ code: 'INTERNAL_SERVER_ERROR', message: err.message }, 500);
  });
}
```

**App builder with mock injection** (lines 118-179):
```typescript
async function buildApp(deps: {
  session?: ReturnType<typeof makeSession>;
  // ... mock deps
}) {
  const { createInvoice } = await import('./createInvoice');
  const { InvoiceRepository } = await import('./repos/billing.repo');
  const { PersonRepository } = await import('../person/repos/person.repo');

  const app = new Hono();
  attachErrorHandler(app);

  app.post('/', async (c) => {
    const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
    (c as any).set('session', session);
    (c as any).set('logger', logger);
    (c as any).set('database', {} as any);

    // Override repository prototypes for mocking
    InvoiceRepository.prototype.findOneById = async () => invoice as any;
    // ... etc

    const body = await c.req.json().catch(() => ({}));
    (c.req as any).valid = (_: string) => body;

    try {
      return await handlerFunction(c as any);
    } finally {
      // Restore prototypes
    }
  });
  return app;
}
```

**Test assertion pattern** (lines 186-207):
```typescript
describe('handlerName — happy path', () => {
  test('description → expected status', async () => {
    const app = await buildApp({});
    const resp = await app.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...}) });
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.field).toBe(expectedValue);
  });
});

describe('handlerName — authorization', () => {
  test('returns 403 when unauthorized', async () => { ... });
});
```

---

## Shared Patterns

### Authentication / Session Access
**Source:** All billing handlers (consistent pattern)
**Apply to:** All handler modifications
```typescript
const session = ctx.get('session') as Session;
const user = session.user;
```

### Admin Role Check
**Source:** `services/api-ts/src/handlers/billing/voidInvoice.ts` (lines 56-58)
**Apply to:** All billing handlers needing admin check (getInvoice, listInvoices, finalizeInvoice, createInvoice)
```typescript
const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
const isAdmin = userRoles.includes('admin');
```

### Error Classes
**Source:** `services/api-ts/src/core/errors.ts`
**Apply to:** All handlers and tests
```typescript
// Available error classes:
// ForbiddenError (403) — access denied
// NotFoundError (404) — resource not found, accepts { resourceType, resource, suggestions }
// ValidationError (400) — input validation failure
// BusinessLogicError (422) — domain logic violation, accepts (message, code)
// ConflictError (409) — state conflict
```

### Repository Instantiation
**Source:** All billing handlers
**Apply to:** All handler modifications
```typescript
const database = ctx.get('database');
const logger = ctx.get('logger');
const invoiceRepo = new InvoiceRepository(database, logger);
```

### Void Threshold Enforcement (new logic for voidInvoice)
**Source:** RESEARCH.md code example
**Apply to:** `voidInvoice.ts`
```typescript
if (invoice.voidThresholdMinutes && invoice.paidAt) {
  const minutesSincePaid = (Date.now() - invoice.paidAt.getTime()) / (1000 * 60);
  if (minutesSincePaid > invoice.voidThresholdMinutes) {
    throw new BusinessLogicError(
      `Cannot void invoice: void threshold of ${invoice.voidThresholdMinutes} minutes has passed`,
      'VOID_THRESHOLD_EXCEEDED'
    );
  }
}
```

## No Analog Found

No files without analogs. All modifications and new test files have exact matches in the existing billing module.

## Metadata

**Analog search scope:** `services/api-ts/src/handlers/billing/`
**Files scanned:** 8 (all billing handlers + tests + repo + schema)
**Pattern extraction date:** 2026-05-06
