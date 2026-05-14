import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { InvoiceRepository } from './repos/billing.repo';
import { getInvoice } from './getInvoice';
import { NotFoundError, ForbiddenError } from '@/core/errors';

const MERCHANT_ID = 'merch-1';
const CUSTOMER_ID = 'cust-1';
const INVOICE_ID = 'inv-1';

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({
    user,
    session: { id: 's-1', userId, user },
    logger: fakeLogger,
    ...extraOverrides,
  });
}

const fakeInvoice = {
  id: INVOICE_ID, invoiceNumber: 'INV-2026-001',
  customer: CUSTOMER_ID, merchant: MERCHANT_ID,
  status: 'open', subtotal: 1000, tax: null, total: 1000,
  currency: 'PHP', paymentCaptureMethod: 'manual',
  paymentDueAt: null, lineItems: [],
  paymentStatus: null, paidAt: null, paidBy: null,
  voidedAt: null, voidedBy: null, voidThresholdMinutes: null,
  authorizedAt: null, authorizedBy: null, context: null, metadata: null,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('getInvoice', () => {
  beforeEach(() => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, { findOneWithLineItems: async () => fakeInvoice });
  });

  afterEach(() => {
    restoreRepo(InvoiceRepository);
  });

  test('returns 200 for merchant viewing own invoice', async () => {
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID }, _query: {} });
    const res = await getInvoice(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.id).toBe(INVOICE_ID);
  });

  test('returns 200 for customer viewing own invoice', async () => {
    const ctx = makeBillingCtx(CUSTOMER_ID, 'user', { _params: { invoice: INVOICE_ID }, _query: {} });
    const res = await getInvoice(ctx);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when invoice not found', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, { findOneWithLineItems: async () => null });
    const ctx = makeBillingCtx(CUSTOMER_ID, 'user', { _params: { invoice: 'nonexistent' }, _query: {} });
    await expect(getInvoice(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not merchant or customer', async () => {
    const ctx = makeBillingCtx('other-user', 'user', { _params: { invoice: INVOICE_ID }, _query: {} });
    await expect(getInvoice(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
