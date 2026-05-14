import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { InvoiceRepository } from './repos/billing.repo';
import { finalizeInvoice } from './finalizeInvoice';
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

const openInvoice = { ...draftInvoice, status: 'open' };

describe('finalizeInvoice', () => {
  beforeEach(() => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => draftInvoice,
      updateStatus: async () => openInvoice,
      findOneWithLineItems: async () => ({ ...openInvoice, lineItems: [] }),
    });
  });

  afterEach(() => {
    restoreRepo(InvoiceRepository);
  });

  test('returns 200 with finalized invoice', async () => {
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID } });
    const res = await finalizeInvoice(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.status).toBe('open');
  });

  test('throws NotFoundError when invoice not found', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => null,
      updateStatus: async () => openInvoice,
      findOneWithLineItems: async () => null,
    });
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: 'nonexistent' } });
    await expect(finalizeInvoice(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when invoice is not draft', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => openInvoice,
      updateStatus: async () => openInvoice,
      findOneWithLineItems: async () => ({ ...openInvoice, lineItems: [] }),
    });
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID } });
    await expect(finalizeInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
