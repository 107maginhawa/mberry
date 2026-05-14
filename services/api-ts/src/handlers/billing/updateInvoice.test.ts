import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
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

const draftInvoice = {
  id: INVOICE_ID, invoiceNumber: 'INV-2026-001',
  merchant: MERCHANT_ID, customer: 'cust-1',
  status: 'draft', total: 1000, currency: 'PHP',
  createdAt: new Date(), updatedAt: new Date(),
};

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
});
