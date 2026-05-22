import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeBillingInvoice } from '@/test-utils/factories';
import { InvoiceRepository } from './repos/billing.repo';
import { deleteInvoice } from './deleteInvoice';
import { NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';

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

describe('deleteInvoice', () => {
  beforeEach(() => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => draftInvoice,
      deleteOneById: async () => {},
    });
  });

  afterEach(() => {
    restoreRepo(InvoiceRepository);
  });

  test('returns 204 when merchant deletes draft invoice', async () => {
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID } });
    const res = await deleteInvoice(ctx);
    expect(res.status).toBe(204);
  });

  test('throws NotFoundError when invoice not found', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => null,
      deleteOneById: async () => {},
    });
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: 'nonexistent' } });
    await expect(deleteInvoice(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when invoice is not draft', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...draftInvoice, status: 'open' }),
      deleteOneById: async () => {},
    });
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID } });
    await expect(deleteInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws ForbiddenError when user is not merchant or admin', async () => {
    const ctx = makeBillingCtx('other-user', 'user', { _params: { invoice: INVOICE_ID } });
    await expect(deleteInvoice(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
