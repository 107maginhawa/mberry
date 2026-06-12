/**
 * Billing Access Control Tests
 *
 * Validates role-based access enforcement:
 * - Non-admin/non-merchant cannot write (create, finalize, delete)
 * - Merchant can create their own invoice
 * - Customer can read own invoice but not others'
 * - Admin bypasses all restrictions
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createInvoice } from './createInvoice';
import { finalizeInvoice } from './finalizeInvoice';
import { deleteInvoice } from './deleteInvoice';
import { getInvoice } from './getInvoice';
import { listInvoices } from './listInvoices';
import { InvoiceRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';

// ─── Fixtures ───────────────────────────────────────────

const MERCHANT_ID = 'merch-uuid-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'cust-uuid-2222-2222-2222-222222222222';
const OTHER_CUSTOMER = 'other-uuid-4444-4444-4444-444444444444';
const ADMIN_ID = 'admin-uuid-5555-5555-5555-555555555555';
const INVOICE_ID = 'inv-uuid-3333-3333-3333-333333333333';

const baseInvoice = {
  id: INVOICE_ID,
  invoiceNumber: 'INV-2026-000001',
  customer: CUSTOMER_ID,
  merchant: MERCHANT_ID,
  merchantAccount: null,
  context: null,
  status: 'draft',
  subtotal: 10000,
  tax: 0,
  total: 10000,
  currency: 'PHP',
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
};

const baseLineItems = [
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
];

const noopLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

// ─── Helpers ────────────────────────────────────────────

let invoiceMocks: ReturnType<typeof stubRepo>;
let personMocks: ReturnType<typeof stubRepo>;

afterEach(() => {
  if (invoiceMocks) Object.values(invoiceMocks).forEach((m) => m.mockRestore());
  if (personMocks) Object.values(personMocks).forEach((m) => m.mockRestore());
});

// ─── Tests ──────────────────────────────────────────────

describe('Billing Access Control', () => {
  test('Non-admin non-merchant cannot create invoice -> 403', async () => {
    personMocks = stubRepo(PersonRepository, {
      findOneById: async (id: string) => {
        if (id === MERCHANT_ID) return { id: MERCHANT_ID, email: 'merchant@test.com' };
        if (id === CUSTOMER_ID) return { id: CUSTOMER_ID, email: 'customer@test.com' };
        return null;
      },
    });
    invoiceMocks = stubRepo(InvoiceRepository, {
      findMany: async () => [],
      createWithLineItems: async () => ({ ...baseInvoice, lineItems: baseLineItems }),
    });

    const ctx = makeCtx({
      user: { id: OTHER_CUSTOMER, role: 'user' },
      logger: noopLogger,
      _body: {
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: [{ description: 'Fee', quantity: 1, unitPrice: 5000 }],
        currency: 'PHP',
      },
    });

    const { ForbiddenError } = await import('@/core/errors');
    await expect(createInvoice(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('Non-admin non-merchant cannot finalize invoice -> 403', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => baseInvoice,
      findOneWithLineItems: async () => ({ ...baseInvoice, lineItems: baseLineItems }),
    });

    const ctx = makeCtx({
      user: { id: OTHER_CUSTOMER, role: 'user' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
    });

    const { ForbiddenError } = await import('@/core/errors');
    await expect(finalizeInvoice(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('Non-admin non-merchant cannot delete invoice -> 403', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => baseInvoice,
      deleteOneById: async () => undefined,
    });

    const ctx = makeCtx({
      user: { id: OTHER_CUSTOMER, role: 'user' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
    });

    const { ForbiddenError } = await import('@/core/errors');
    await expect(deleteInvoice(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('Merchant can create their own invoice -> 201', async () => {
    const createdInvoice = { ...baseInvoice, lineItems: baseLineItems };

    personMocks = stubRepo(PersonRepository, {
      findOneById: async (id: string) => {
        if (id === MERCHANT_ID) return { id: MERCHANT_ID, email: 'merchant@test.com' };
        if (id === CUSTOMER_ID) return { id: CUSTOMER_ID, email: 'customer@test.com' };
        return null;
      },
    });
    invoiceMocks = stubRepo(InvoiceRepository, {
      findMany: async () => [],
      createWithLineItems: async () => createdInvoice,
    });

    const ctx = makeCtx({
      user: { id: MERCHANT_ID, role: 'user' },
      logger: noopLogger,
      _body: {
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: [{ description: 'Fee', quantity: 1, unitPrice: 10000 }],
        currency: 'PHP',
      },
    });

    const response = await createInvoice(ctx);
    expect(response.status).toBe(201);
  });

  test('Customer can read their own invoice (getInvoice) -> 200', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneWithLineItems: async () => ({ ...baseInvoice, lineItems: baseLineItems }),
    });

    const ctx = makeCtx({
      user: { id: CUSTOMER_ID, role: 'user' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
      _query: {},
    });

    const response = await getInvoice(ctx);
    expect(response.status).toBe(200);
  });

  test('Customer cannot read another customer\'s invoice -> 403', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneWithLineItems: async () => ({ ...baseInvoice, lineItems: baseLineItems }),
    });

    const ctx = makeCtx({
      user: { id: OTHER_CUSTOMER, role: 'user' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
      _query: {},
    });

    const { ForbiddenError } = await import('@/core/errors');
    await expect(getInvoice(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('Admin can read any invoice -> 200', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneWithLineItems: async () => ({ ...baseInvoice, lineItems: baseLineItems }),
    });

    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
      _query: {},
    });

    const response = await getInvoice(ctx);
    expect(response.status).toBe(200);
  });
});

// ─── FIX-003: listInvoices filter self-scoping ──────────────────────────────
// Non-admins must not enumerate another merchant's/customer's invoices by
// passing a foreign ?merchant= / ?customer= filter. The original guard only
// fired when ?customer= was set, leaving ?merchant=<foreign> unscoped.

describe('Billing Access Control — listInvoices filter self-scoping (FIX-003)', () => {
  test('Non-admin passing a foreign ?merchant= filter is denied -> 403', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async () => ({ data: [baseInvoice], totalCount: 1 }),
      findLineItemsByInvoiceIds: async () => new Map(),
    });

    const ctx = makeCtx({
      user: { id: CUSTOMER_ID, role: 'user' },
      logger: noopLogger,
      _query: { merchant: MERCHANT_ID }, // foreign merchant (not self), no customer filter
    });

    const { ForbiddenError } = await import('@/core/errors');
    await expect(listInvoices(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('Non-admin passing a foreign ?customer= filter is denied -> 403', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async () => ({ data: [baseInvoice], totalCount: 1 }),
      findLineItemsByInvoiceIds: async () => new Map(),
    });

    const ctx = makeCtx({
      user: { id: CUSTOMER_ID, role: 'user' },
      logger: noopLogger,
      _query: { customer: OTHER_CUSTOMER },
    });

    const { ForbiddenError } = await import('@/core/errors');
    await expect(listInvoices(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('Admin may pass a foreign ?merchant= filter -> 200', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async () => ({ data: [baseInvoice], totalCount: 1 }),
      findLineItemsByInvoiceIds: async () => new Map(),
    });

    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      logger: noopLogger,
      _query: { merchant: MERCHANT_ID },
    });

    const response = await listInvoices(ctx);
    expect(response.status).toBe(200);
  });

  test('Merchant may scope to own ?merchant=self with a ?customer= filter -> 200 (legit path preserved)', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async () => ({ data: [baseInvoice], totalCount: 1 }),
      findLineItemsByInvoiceIds: async () => new Map(),
    });

    const ctx = makeCtx({
      user: { id: MERCHANT_ID, role: 'user' },
      logger: noopLogger,
      _query: { merchant: MERCHANT_ID, customer: CUSTOMER_ID },
    });

    const response = await listInvoices(ctx);
    expect(response.status).toBe(200);
  });
});
