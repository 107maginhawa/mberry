import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { captureInvoicePayment } from './captureInvoicePayment';
import { NotFoundError, ConflictError } from '@/core/errors';

const ADMIN_ID = 'admin-1';
const INVOICE_ID = 'inv-1';
const MERCHANT_PERSON_ID = 'merch-person-1';

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({ user, session: { id: 's-1', userId, user }, logger: fakeLogger, ...extraOverrides });
}

const authorizedInvoice = {
  id: INVOICE_ID, invoiceNumber: 'INV-2026-001',
  merchant: MERCHANT_PERSON_ID, customer: 'cust-1',
  status: 'open', total: 1000, currency: 'PHP',
  paymentStatus: 'requires_capture', paymentCaptureMethod: 'manual',
  merchantAccount: 'ma-1',
  authorizedAt: new Date(), authorizedBy: 'cust-1',
  metadata: { stripePaymentIntentId: 'pi_test' },
  createdAt: new Date(), updatedAt: new Date(),
};

const fakeBilling = { capturePaymentIntent: async () => ({ id: 'pi_captured', status: 'succeeded' }) };

describe('captureInvoicePayment', () => {
  beforeEach(() => {
    restoreRepo(InvoiceRepository);
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
    let callCount = 0;
    stubRepo(InvoiceRepository, {
      findOneById: async () => {
        callCount++;
        if (callCount === 1) return { ...authorizedInvoice };
        return { ...authorizedInvoice, paymentStatus: 'succeeded', status: 'paid' };
      },
      updatePaymentStatus: async () => ({ ...authorizedInvoice, paymentStatus: 'succeeded' }),
      updateOneById: async () => ({ ...authorizedInvoice, paymentStatus: 'succeeded', status: 'paid' }),
    });
    stubRepo(MerchantAccountRepository, {
      findOneById: async () => ({ id: 'ma-1', stripeAccountId: 'acct_test', metadata: { stripeAccountId: 'acct_test' } }),
      findByPerson: async () => ({ id: 'ma-1', stripeAccountId: 'acct_test', metadata: { stripeAccountId: 'acct_test' } }),
    });
    stubRepo(PersonRepository, { findOneById: async () => ({ id: MERCHANT_PERSON_ID }) });
  });

  afterEach(() => {
    restoreRepo(InvoiceRepository);
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
  });

  test('returns 200 when admin captures authorized payment', async () => {
    const ctx = makeBillingCtx(ADMIN_ID, 'admin', { billing: fakeBilling, _params: { invoice: INVOICE_ID } });
    const res = await captureInvoicePayment(ctx);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when invoice not found', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, { findOneById: async () => null });
    const ctx = makeBillingCtx(ADMIN_ID, 'admin', { billing: fakeBilling, _params: { invoice: 'nonexistent' } });
    await expect(captureInvoicePayment(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ConflictError when payment already captured', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...authorizedInvoice, paymentStatus: 'succeeded' }),
    });
    const ctx = makeBillingCtx(ADMIN_ID, 'admin', { billing: fakeBilling, _params: { invoice: INVOICE_ID } });
    await expect(captureInvoicePayment(ctx)).rejects.toBeInstanceOf(ConflictError);
  });
});
