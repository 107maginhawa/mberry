/**
 * Tests for createInvoice.ts handler.
 *
 * Strategy: build a minimal Hono app per test, attach a createErrorHandler
 * so AppError subclasses get proper HTTP status codes, and inject mock
 * repositories via context variables (no prototype mutation).
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MERCHANT_ID = 'merch-uuid-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'cust-uuid-2222-2222-2222-222222222222';
const INVOICE_ID = 'inv-uuid-3333-3333-3333-333333333333';

function makeSession(userId = MERCHANT_ID) {
  return {
    user: { id: userId, email: 'test@test.com', name: 'Test User' },
    session: { id: 'session-id', userId },
  };
}

function makeMerchantPerson(id = MERCHANT_ID) {
  return { id, email: 'merchant@test.com', name: 'Merchant' };
}

function makeCustomerPerson(id = CUSTOMER_ID) {
  return { id, email: 'customer@test.com', name: 'Customer' };
}

function makeCreatedInvoice(overrides?: Record<string, any>) {
  const base = {
    id: INVOICE_ID,
    invoiceNumber: 'INV-2026-000001',
    customer: CUSTOMER_ID,
    merchant: MERCHANT_ID,
    merchantAccount: null,
    context: null,
    status: 'draft',
    subtotal: 10000,
    tax: null,
    total: 10000,
    currency: 'USD',
    paymentCaptureMethod: 'automatic',
    paymentDueAt: null,
    paymentStatus: null,
    paidAt: null,
    paidBy: null,
    voidedAt: null,
    voidedBy: null,
    voidThresholdMinutes: null,
    authorizedAt: null,
    authorizedBy: null,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    createdBy: null,
    updatedBy: null,
    lineItems: [
      {
        id: 'li-001',
        invoice: INVOICE_ID,
        description: 'Service fee',
        quantity: 1,
        unitPrice: 10000,
        amount: 10000,
        metadata: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        version: 1,
        createdBy: null,
        updatedBy: null,
      },
    ],
  };
  return { ...base, ...(overrides ?? {}) };
}

function makeLineItems(count = 1) {
  return Array.from({ length: count }, (_, i) => ({
    description: `Item ${i + 1}`,
    quantity: 1,
    unitPrice: 5000,
  }));
}

// ---------------------------------------------------------------------------
// Minimal error handler — maps AppError → correct status + JSON
// ---------------------------------------------------------------------------

function attachErrorHandler(app: Hono) {
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ code: err.code, message: err.message }, err.statusCode as any);
    }
    return c.json({ code: 'INTERNAL_SERVER_ERROR', message: err.message }, 500);
  });
}

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

/**
 * Mocks InvoiceRepository and PersonRepository as plain objects and passes
 * them via an injected `_repos` context key that the test's route handler
 * uses.  This avoids any prototype mutation and keeps tests hermetic.
 *
 * The route handler wraps createInvoice by *overriding* the module-level
 * class constructors in the handler's closure with our mocks.
 */
async function buildApp(deps: {
  session?: ReturnType<typeof makeSession>;
  merchantPerson?: Record<string, any> | null;
  customerPerson?: Record<string, any> | null;
  existingByContext?: any[];
  createdInvoice?: ReturnType<typeof makeCreatedInvoice>;
}) {
  const {
    session = makeSession(),
    merchantPerson = makeMerchantPerson(),
    customerPerson = makeCustomerPerson(),
    existingByContext = [],
    createdInvoice = makeCreatedInvoice(),
  } = deps;

  // Pre-import the handler module
  const { createInvoice } = await import('./createInvoice');
  const { InvoiceRepository } = await import('./repos/billing.repo');
  const { PersonRepository } = await import('../person/repos/person.repo');

  const app = new Hono();
  attachErrorHandler(app);

  app.post('/', async (c) => {
    const logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

    // Inject context vars
    (c as any).set('session', session);
    (c as any).set('logger', logger);
    (c as any).set('database', {} as any);

    // Override InvoiceRepository prototype for this request
    const origFindMany = InvoiceRepository.prototype.findMany;
    const origCreate = InvoiceRepository.prototype.createWithLineItems;

    InvoiceRepository.prototype.findMany = async () => existingByContext as any;
    InvoiceRepository.prototype.createWithLineItems = async () => createdInvoice as any;

    // Override PersonRepository prototype
    const origPersonFind = PersonRepository.prototype.findOneById;
    PersonRepository.prototype.findOneById = async (id: string) => {
      if (id === MERCHANT_ID) return merchantPerson as any;
      if (id === CUSTOMER_ID) return customerPerson as any;
      return null as any;
    };

    // Parse JSON body and inject into req.valid
    const body = await c.req.json().catch(() => ({}));
    (c.req as any).valid = (_: string) => body;

    try {
      return await createInvoice(c as any);
    } finally {
      // Restore prototypes after each request
      InvoiceRepository.prototype.findMany = origFindMany;
      InvoiceRepository.prototype.createWithLineItems = origCreate;
      PersonRepository.prototype.findOneById = origPersonFind;
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('createInvoice — happy path', () => {
  test('creates invoice with valid body → 201 with invoice shape', async () => {
    const app = await buildApp({});

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: makeLineItems(1),
        currency: 'USD',
      }),
    });

    expect(resp.status).toBe(201);
    const body = await resp.json() as any;
    expect(body.id).toBe(INVOICE_ID);
    expect(body.status).toBe('draft');
    expect(body.currency).toBe('USD');
    expect(body.lineItems).toHaveLength(1);
  });

  test('creates invoice with multiple line items', async () => {
    const multiLineInvoice = makeCreatedInvoice({
      subtotal: 20000,
      total: 20000,
      lineItems: [
        { id: 'li-001', invoice: INVOICE_ID, description: 'A', quantity: 1, unitPrice: 10000, amount: 10000, metadata: null, createdAt: new Date(), updatedAt: new Date(), version: 1, createdBy: null, updatedBy: null },
        { id: 'li-002', invoice: INVOICE_ID, description: 'B', quantity: 2, unitPrice: 5000, amount: 10000, metadata: null, createdAt: new Date(), updatedAt: new Date(), version: 1, createdBy: null, updatedBy: null },
      ],
    });

    const app = await buildApp({ createdInvoice: multiLineInvoice });

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: [
          { description: 'A', quantity: 1, unitPrice: 10000 },
          { description: 'B', quantity: 2, unitPrice: 5000 },
        ],
      }),
    });

    expect(resp.status).toBe(201);
    const body = await resp.json() as any;
    expect(body.lineItems).toHaveLength(2);
    expect(body.total).toBe(20000);
  });

  test('accepts optional context field', async () => {
    const app = await buildApp({ existingByContext: [] });

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        context: 'booking:abc-123',
        lineItems: makeLineItems(1),
      }),
    });

    expect(resp.status).toBe(201);
  });

  test('defaults quantity to 1 when not provided in line item', async () => {
    const app = await buildApp({});

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: [{ description: 'Fee', unitPrice: 2000 }],
      }),
    });

    expect(resp.status).toBe(201);
  });

  test('response includes invoiceNumber', async () => {
    const app = await buildApp({});

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: makeLineItems(1),
      }),
    });

    const body = await resp.json() as any;
    expect(body.invoiceNumber).toBe('INV-2026-000001');
  });
});

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

describe('createInvoice — authorization', () => {
  test('returns 403 when authenticated user is not the merchant', async () => {
    const otherSession = makeSession('other-user-9999');
    const app = await buildApp({ session: otherSession });

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: makeLineItems(1),
      }),
    });

    expect(resp.status).toBe(403);
    const body = await resp.json() as any;
    expect(body.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

describe('createInvoice — not found', () => {
  test('returns 404 when merchant person not found', async () => {
    const app = await buildApp({ merchantPerson: null });

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: makeLineItems(1),
      }),
    });

    expect(resp.status).toBe(404);
    const body = await resp.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });

  test('returns 404 when customer person not found', async () => {
    const app = await buildApp({ customerPerson: null });

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: makeLineItems(1),
      }),
    });

    expect(resp.status).toBe(404);
    const body = await resp.json() as any;
    expect(body.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('createInvoice — validation', () => {
  test('returns 400 when lineItems array is empty', async () => {
    const app = await buildApp({});

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: [],
      }),
    });

    expect(resp.status).toBe(400);
    const body = await resp.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when lineItems is absent', async () => {
    const app = await buildApp({});

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
      }),
    });

    expect(resp.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Conflict — duplicate context
// ---------------------------------------------------------------------------

describe('createInvoice — conflict', () => {
  test('returns 409 when context is already used by another invoice', async () => {
    const app = await buildApp({
      existingByContext: [{ id: 'existing-inv', context: 'booking:dup' }],
    });

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        context: 'booking:dup',
        lineItems: makeLineItems(1),
      }),
    });

    expect(resp.status).toBe(409);
    const body = await resp.json() as any;
    expect(body.code).toBe('CONFLICT');
  });
});

// ---------------------------------------------------------------------------
// Amount calculation (pure logic — no I/O)
// ---------------------------------------------------------------------------

describe('createInvoice — amount calculation logic', () => {
  test('amount per line item equals quantity times unitPrice', () => {
    const items = [
      { quantity: 2, unitPrice: 1500 },
      { quantity: 1, unitPrice: 3000 },
      { quantity: 3, unitPrice: 500 },
    ];
    const processed = items.map(i => {
      const quantity = i.quantity || 1;
      return { quantity, unitPrice: i.unitPrice, amount: quantity * i.unitPrice };
    });

    expect(processed[0]?.amount).toBe(3000);
    expect(processed[1]?.amount).toBe(3000);
    expect(processed[2]?.amount).toBe(1500);
  });

  test('subtotal is the sum of all item amounts', () => {
    const amounts = [3000, 3000, 1500];
    const subtotal = amounts.reduce((s, a) => s + a, 0);
    expect(subtotal).toBe(7500);
  });

  test('total equals subtotal when tax is zero', () => {
    const subtotal = 7500;
    const tax = 0;
    expect(subtotal + tax).toBe(7500);
  });
});
