/**
 * listInvoices Response Field Completeness Tests
 *
 * Validates that all response fields are populated from DB (not null/hardcoded),
 * line items are included, and customer-scoped filtering works correctly.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { listInvoices } from './listInvoices';
import { InvoiceRepository } from './repos/billing.repo';

// ─── Fixtures ───────────────────────────────────────────

const MERCHANT_ID = 'merch-uuid-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'cust-uuid-2222-2222-2222-222222222222';
const OTHER_CUSTOMER = 'other-uuid-4444-4444-4444-444444444444';
const ADMIN_ID = 'admin-uuid-5555-5555-5555-555555555555';
const INVOICE_ID = 'inv-uuid-3333-3333-3333-333333333333';
const INVOICE_ID_2 = 'inv-uuid-6666-6666-6666-666666666666';

const fullyPopulatedInvoice = {
  id: INVOICE_ID,
  invoiceNumber: 'INV-2026-000001',
  customer: CUSTOMER_ID,
  merchant: MERCHANT_ID,
  merchantAccount: null,
  context: 'booking:abc-123',
  status: 'paid',
  subtotal: 15000,
  tax: 1500,
  total: 16500,
  currency: 'PHP',
  paymentCaptureMethod: 'manual',
  paymentDueAt: new Date('2026-02-01T00:00:00Z'),
  paymentStatus: 'succeeded',
  paidAt: new Date('2026-01-15T10:00:00Z'),
  paidBy: ADMIN_ID,
  voidedAt: null,
  voidedBy: null,
  voidThresholdMinutes: 120,
  authorizedAt: new Date('2026-01-10T08:00:00Z'),
  authorizedBy: MERCHANT_ID,
  metadata: { note: 'test-invoice' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-15T10:00:00Z'),
  version: 3,
  createdBy: MERCHANT_ID,
  updatedBy: ADMIN_ID,
};

const otherCustomerInvoice = {
  ...fullyPopulatedInvoice,
  id: INVOICE_ID_2,
  invoiceNumber: 'INV-2026-000002',
  customer: OTHER_CUSTOMER,
};

const lineItemsForInvoice = [
  {
    id: 'li-001',
    invoice: INVOICE_ID,
    description: 'Consultation fee',
    quantity: 2,
    unitPrice: 7500,
    amount: 15000,
    metadata: { code: 'CONSULT' },
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

afterEach(() => {
  if (invoiceMocks) Object.values(invoiceMocks).forEach((m) => m.mockRestore());
});

// ─── Tests ──────────────────────────────────────────────

describe('listInvoices', () => {
  test('Response includes paymentCaptureMethod (not null/hardcoded)', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async () => ({
        data: [fullyPopulatedInvoice],
        totalCount: 1,
      }),
      findLineItemsByInvoiceIds: async () => new Map([[INVOICE_ID, lineItemsForInvoice]]),
    });

    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      logger: noopLogger,
      _query: {},
    });

    const response = await listInvoices(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data[0].paymentCaptureMethod).toBe('manual');
  });

  test('Response includes lineItems array with description, quantity, unitPrice, amount', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async () => ({
        data: [fullyPopulatedInvoice],
        totalCount: 1,
      }),
      findLineItemsByInvoiceIds: async () => new Map([[INVOICE_ID, lineItemsForInvoice]]),
    });

    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      logger: noopLogger,
      _query: {},
    });

    const response = await listInvoices(ctx);
    const invoice = response.body.data[0];
    expect(invoice.lineItems).toHaveLength(1);
    expect(invoice.lineItems[0].description).toBe('Consultation fee');
    expect(invoice.lineItems[0].quantity).toBe(2);
    expect(invoice.lineItems[0].unitPrice).toBe(7500);
    expect(invoice.lineItems[0].amount).toBe(15000);
  });

  test('Response includes paidBy, voidedBy, authorizedAt, authorizedBy when set', async () => {
    const voidedInvoice = {
      ...fullyPopulatedInvoice,
      status: 'void',
      voidedAt: new Date('2026-01-20T12:00:00Z'),
      voidedBy: ADMIN_ID,
    };

    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async () => ({
        data: [voidedInvoice],
        totalCount: 1,
      }),
      findLineItemsByInvoiceIds: async () => new Map([[INVOICE_ID, lineItemsForInvoice]]),
    });

    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      logger: noopLogger,
      _query: {},
    });

    const response = await listInvoices(ctx);
    const invoice = response.body.data[0];
    expect(invoice.paidBy).toBe(ADMIN_ID);
    expect(invoice.voidedBy).toBe(ADMIN_ID);
    expect(invoice.authorizedAt).toBe('2026-01-10T08:00:00.000Z');
    expect(invoice.authorizedBy).toBe(MERCHANT_ID);
  });

  test('Non-admin only sees invoices where customer=self or merchant=self', async () => {
    // When user is CUSTOMER_ID, the handler should use customerOrMerchant filter
    // We simulate the repo returning only that user's invoices
    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async (filters: any) => {
        // Verify the handler passes customerOrMerchant filter
        if (filters?.customerOrMerchant === CUSTOMER_ID) {
          return { data: [fullyPopulatedInvoice], totalCount: 1 };
        }
        // If no scope filter, return all (should not happen for non-admin)
        return { data: [fullyPopulatedInvoice, otherCustomerInvoice], totalCount: 2 };
      },
      findLineItemsByInvoiceIds: async () => new Map([[INVOICE_ID, lineItemsForInvoice]]),
    });

    const ctx = makeCtx({
      user: { id: CUSTOMER_ID, role: 'user' },
      logger: noopLogger,
      _query: {},
    });

    const response = await listInvoices(ctx);
    expect(response.status).toBe(200);
    // Should only get invoices scoped to CUSTOMER_ID
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].customer).toBe(CUSTOMER_ID);
  });

  test('Admin sees all invoices regardless of customer/merchant', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findManyWithPagination: async () => ({
        data: [fullyPopulatedInvoice, otherCustomerInvoice],
        totalCount: 2,
      }),
      findLineItemsByInvoiceIds: async () => {
        const map = new Map();
        map.set(INVOICE_ID, lineItemsForInvoice);
        map.set(INVOICE_ID_2, []);
        return map;
      },
    });

    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      logger: noopLogger,
      _query: {},
    });

    const response = await listInvoices(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });
});
