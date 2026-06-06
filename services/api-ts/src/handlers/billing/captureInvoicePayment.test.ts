import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeBillingInvoice } from '@/test-utils/factories';
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

const authorizedInvoice = fakeBillingInvoice({
  id: INVOICE_ID, invoiceNumber: 'INV-2026-001',
  merchant: MERCHANT_PERSON_ID, customer: 'cust-1',
  status: 'open', total: 1000, currency: 'PHP',
  paymentStatus: 'requires_capture', paymentCaptureMethod: 'manual',
  merchantAccount: 'ma-1',
  authorizedAt: new Date(), authorizedBy: 'cust-1',
  metadata: { stripePaymentIntentId: 'pi_test' },
  createdAt: new Date(), updatedAt: new Date(),
});

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

// ---------------------------------------------------------------------------
// Observability: structured log fields (Wave 4.5)
// ---------------------------------------------------------------------------

describe('captureInvoicePayment — observability: structured log fields', () => {
  /**
   * Make a capturing logger with .child() support (returns new logger with merged bindings).
   */
  function makeCapturingLogger(calls: any[]) {
    function makeChild(inherited: Record<string, any>) {
      return {
        debug: (obj: any, msg?: string) => calls.push({ level: 'debug', ...inherited, ...obj, msg }),
        info:  (obj: any, msg?: string) => calls.push({ level: 'info',  ...inherited, ...obj, msg }),
        warn:  (obj: any, msg?: string) => calls.push({ level: 'warn',  ...inherited, ...obj, msg }),
        error: (obj: any, msg?: string) => calls.push({ level: 'error', ...inherited, ...obj, msg }),
        child: (bindings: Record<string, any>) => makeChild({ ...inherited, ...bindings }),
      };
    }
    return makeChild({});
  }

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
      updateOneById: async () => ({ ...authorizedInvoice, paymentStatus: 'succeeded', status: 'paid' }),
    });
    stubRepo(MerchantAccountRepository, {
      findByPerson: async () => ({ id: 'ma-1', metadata: { stripeAccountId: 'acct_test' } }),
    });
    stubRepo(PersonRepository, { findOneById: async () => ({ id: MERCHANT_PERSON_ID }) });
  });

  afterEach(() => {
    restoreRepo(InvoiceRepository);
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
  });

  test('all log calls carry traceId and module fields', async () => {
    const calls: any[] = [];
    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      session: { id: 's-1', userId: ADMIN_ID, user: { id: ADMIN_ID, role: 'admin' } },
      logger: makeCapturingLogger(calls),
      requestId: 'trace-cap-001',
      billing: fakeBilling,
      _params: { invoice: INVOICE_ID },
    });

    await captureInvoicePayment(ctx);

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.traceId).toBe('trace-cap-001');
      expect(call.module).toBe('billing');
    }
  });

  test('success log includes action and invoiceId', async () => {
    const calls: any[] = [];
    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      session: { id: 's-1', userId: ADMIN_ID, user: { id: ADMIN_ID, role: 'admin' } },
      logger: makeCapturingLogger(calls),
      requestId: 'trace-cap-002',
      billing: fakeBilling,
      _params: { invoice: INVOICE_ID },
    });

    await captureInvoicePayment(ctx);

    const capturedLog = calls.find(c => c.action === 'captureInvoicePayment.captured');
    expect(capturedLog).toBeDefined();
    expect(capturedLog.invoiceId).toBe(INVOICE_ID);
  });
});
