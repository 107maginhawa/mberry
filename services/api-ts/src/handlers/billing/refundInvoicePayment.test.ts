import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeBillingInvoice } from '@/test-utils/factories';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { refundInvoicePayment } from './refundInvoicePayment';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

const ADMIN_ID = 'admin-1';
const INVOICE_ID = 'inv-1';
const MERCHANT_ID = 'merch-1';

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({ user, session: { id: 's-1', userId, user }, logger: fakeLogger, ...extraOverrides });
}

const capturedInvoice = fakeBillingInvoice({
  id: INVOICE_ID, invoiceNumber: 'INV-2026-001',
  merchant: MERCHANT_ID, customer: 'cust-1',
  status: 'open', total: 1000, currency: 'PHP',
  paymentStatus: 'succeeded',
  metadata: { stripePaymentIntentId: 'pi_test', stripeChargeId: 'ch_test', stripeAccountId: 'acct_test' },
  createdAt: new Date(), updatedAt: new Date(),
});

const fakeBilling = { createRefund: async () => ({ id: 're_test', status: 'succeeded' }) };

describe('refundInvoicePayment', () => {
  beforeEach(() => {
    restoreRepo(InvoiceRepository);
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => capturedInvoice,
      updateOneById: async () => ({ ...capturedInvoice, paymentStatus: 'refunded', metadata: {} }),
    });
    stubRepo(MerchantAccountRepository, {
      findOneById: async () => ({ id: 'ma-1', stripeAccountId: 'acct_test', metadata: { stripeAccountId: 'acct_test' } }),
      findByPerson: async () => ({ id: 'ma-1', stripeAccountId: 'acct_test', metadata: { stripeAccountId: 'acct_test' } }),
    });
    stubRepo(PersonRepository, { findOneById: async () => ({ id: MERCHANT_ID }) });
  });

  afterEach(() => {
    restoreRepo(InvoiceRepository);
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
  });

  test('returns 200 when admin refunds captured payment', async () => {
    const ctx = makeBillingCtx(ADMIN_ID, 'admin', { billing: fakeBilling, _params: { invoice: INVOICE_ID }, _body: { amount: 500, reason: 'duplicate' } });
    const res = await refundInvoicePayment(ctx);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when invoice not found', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, { findOneById: async () => null });
    const ctx = makeBillingCtx(ADMIN_ID, 'admin', { billing: fakeBilling, _params: { invoice: 'nonexistent' }, _body: { amount: 500, reason: 'duplicate' } });
    await expect(refundInvoicePayment(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when payment not captured', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...capturedInvoice, paymentStatus: 'authorized' }),
    });
    const ctx = makeBillingCtx(ADMIN_ID, 'admin', { billing: fakeBilling, _params: { invoice: INVOICE_ID }, _body: { amount: 500, reason: 'duplicate' } });
    await expect(refundInvoicePayment(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
