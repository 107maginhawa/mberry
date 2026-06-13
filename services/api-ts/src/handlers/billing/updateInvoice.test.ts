import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeBillingInvoice } from '@/test-utils/factories';
import { InvoiceRepository } from './repos/billing.repo';
import { updateInvoice } from './updateInvoice';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

const MERCHANT_ID = 'merch-1';
const INVOICE_ID = 'inv-1';

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({ user, session: { id: 's-1', userId, user }, logger: fakeLogger, ...extraOverrides });
}

const draftInvoice = fakeBillingInvoice({
  id: INVOICE_ID, invoiceNumber: 'INV-2026-001',
  merchant: MERCHANT_ID, customer: 'cust-1',
  status: 'draft', total: 1000, currency: 'PHP',
  createdAt: new Date(), updatedAt: new Date(),
});

const updatedInvoice = { ...draftInvoice, total: 2000 };

describe('updateInvoice', () => {
  beforeEach(() => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => draftInvoice,
      updateOneById: async () => updatedInvoice,
      findOneWithLineItems: async () => ({ ...updatedInvoice, lineItems: [] }),
    });
  });

  afterEach(() => {
    restoreRepo(InvoiceRepository);
  });

  test('returns 200 with updated invoice (draft only)', async () => {
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID }, _body: { total: 2000 } });
    const res = await updateInvoice(ctx);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when invoice not found', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => null,
      updateOneById: async () => updatedInvoice,
      findOneWithLineItems: async () => null,
    });
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: 'nonexistent' }, _body: {} });
    await expect(updateInvoice(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when invoice is not draft', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...draftInvoice, status: 'open' }),
      updateOneById: async () => updatedInvoice,
      findOneWithLineItems: async () => ({ ...updatedInvoice, lineItems: [] }),
    });
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID }, _body: {} });
    await expect(updateInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // FIX-007 / AC-M21-002: line-item replacement must transactionally persist the
  // new rows AND recompute the stored total. The old code updated the invoice
  // total but never replaced the line-item rows, so a reload returned stale rows
  // whose sum diverged from the persisted total.
  test('transactionally replaces line items so reloaded rows == request and total == sum of rows', async () => {
    restoreRepo(InvoiceRepository);

    // Stateful store seeded with the OLD line items + old total. updateOneById
    // (the buggy non-transactional path) updates invoice fields but NOT the rows;
    // replaceLineItems (the fix) swaps the rows and total together.
    let store: { lineItems: any[]; subtotal: number; total: number } = {
      lineItems: [{ id: 'li-old', invoice: INVOICE_ID, description: 'OLD', quantity: 1, unitPrice: 1000, amount: 1000, metadata: null }],
      subtotal: 1000,
      total: 1000,
    };

    stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...draftInvoice }),
      updateOneById: async (_id: string, data: any) => {
        // Buggy path: persists invoice fields only — line-item rows untouched.
        store = { ...store, subtotal: data.subtotal ?? store.subtotal, total: data.total ?? store.total };
        return { ...draftInvoice, ...data };
      },
      replaceLineItems: async (_id: string, lineItemsData: any[], invoiceUpdate: any) => {
        const rows = lineItemsData.map((li, i) => ({ id: `li-${i}`, invoice: INVOICE_ID, metadata: null, ...li }));
        store = { lineItems: rows, subtotal: invoiceUpdate.subtotal, total: invoiceUpdate.total };
        return { ...draftInvoice, ...invoiceUpdate, lineItems: rows };
      },
      findOneWithLineItems: async () => ({ ...draftInvoice, subtotal: store.subtotal, total: store.total, lineItems: store.lineItems }),
    });

    const requestLineItems = [
      { description: 'A', quantity: 2, unitPrice: 500 }, // amount 1000
      { description: 'B', quantity: 1, unitPrice: 750 }, // amount 750
    ];
    const expectedTotal = 1000 + 750;

    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', {
      _params: { invoice: INVOICE_ID },
      _body: { lineItems: requestLineItems },
    });
    const res = await updateInvoice(ctx);

    expect(res.status).toBe(200);
    // Reloaded rows match the request (not the stale OLD row)
    expect(res.body.lineItems).toHaveLength(2);
    expect(res.body.lineItems.map((li: any) => li.description)).toEqual(['A', 'B']);
    expect(res.body.lineItems.map((li: any) => li.amount)).toEqual([1000, 750]);
    // Persisted total == sum of the persisted rows
    expect(res.body.total).toBe(expectedTotal);
    expect(res.body.lineItems.reduce((s: number, li: any) => s + li.amount, 0)).toBe(res.body.total);
  });
});
