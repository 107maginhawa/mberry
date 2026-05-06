/**
 * Invoice Lifecycle Tests
 *
 * Validates the full invoice lifecycle: create -> finalize -> pay -> void
 * Covers state machine transitions and void threshold enforcement (D-04, D-06).
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { createInvoice } from './createInvoice';
import { finalizeInvoice } from './finalizeInvoice';
import { captureInvoicePayment } from './captureInvoicePayment';
import { voidInvoice } from './voidInvoice';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';

// ─── Fixtures ───────────────────────────────────────────

const MERCHANT_ID = 'merch-uuid-1111-1111-1111-111111111111';
const CUSTOMER_ID = 'cust-uuid-2222-2222-2222-222222222222';
const ADMIN_ID = 'admin-uuid-5555-5555-5555-555555555555';
const INVOICE_ID = 'inv-uuid-3333-3333-3333-333333333333';

const baseDraftInvoice = {
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
  voidThresholdMinutes: 60,
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

const openInvoice = {
  ...baseDraftInvoice,
  status: 'open',
  paymentDueAt: new Date('2026-02-01T00:00:00Z'),
  paymentStatus: 'requires_capture',
  metadata: { stripePaymentIntentId: 'pi_test_123' },
};

const paidInvoice = {
  ...openInvoice,
  status: 'paid',
  paymentStatus: 'succeeded',
  paidAt: new Date(), // just paid
  paidBy: ADMIN_ID,
};

const voidedInvoice = {
  ...openInvoice,
  status: 'void',
  paymentStatus: 'canceled',
  voidedAt: new Date(),
  voidedBy: ADMIN_ID,
  metadata: {
    stripePaymentIntentId: 'pi_test_123',
    providerDecision: 'void',
    providerDecisionAt: new Date().toISOString(),
  },
};

const fakeMerchantAccount = {
  id: 'ma-1',
  person: MERCHANT_ID,
  active: true,
  metadata: { stripeAccountId: 'acct_test_456' },
};

const fakeBilling = {
  cancelPaymentIntent: async () => ({ id: 'pi_test_123', status: 'canceled' }),
  capturePaymentIntent: async () => ({ id: 'pi_test_123', status: 'succeeded' }),
};

const noopLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

// ─── Helpers ────────────────────────────────────────────

let invoiceMocks: ReturnType<typeof stubRepo>;
let merchantMocks: ReturnType<typeof stubRepo>;
let personMocks: ReturnType<typeof stubRepo>;

afterEach(() => {
  if (invoiceMocks) Object.values(invoiceMocks).forEach((m) => m.mockRestore());
  if (merchantMocks) Object.values(merchantMocks).forEach((m) => m.mockRestore());
  if (personMocks) Object.values(personMocks).forEach((m) => m.mockRestore());
});

// ─── Tests ──────────────────────────────────────────────

describe('Invoice Lifecycle', () => {
  test('Admin creates invoice with lineItems -> 201 with invoiceNumber, status=draft', async () => {
    const createdInvoice = { ...baseDraftInvoice, lineItems: baseLineItems };

    invoiceMocks = stubRepo(InvoiceRepository, {
      findMany: async () => [],
      createWithLineItems: async () => createdInvoice,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async (id: string) => {
        if (id === MERCHANT_ID) return { id: MERCHANT_ID, email: 'merchant@test.com' };
        if (id === CUSTOMER_ID) return { id: CUSTOMER_ID, email: 'customer@test.com' };
        return null;
      },
    });

    const ctx = makeCtx({
      user: { id: MERCHANT_ID, role: 'admin' },
      logger: noopLogger,
      _body: {
        customer: CUSTOMER_ID,
        merchant: MERCHANT_ID,
        lineItems: [{ description: 'Service fee', quantity: 1, unitPrice: 10000 }],
        currency: 'PHP',
      },
    });

    const response = await createInvoice(ctx);
    expect(response.status).toBe(201);
    expect(response.body.invoiceNumber).toBe('INV-2026-000001');
    expect(response.body.status).toBe('draft');
  });

  test('Admin finalizes invoice -> status=open, paymentDueAt populated', async () => {
    const finalizedInvoice = {
      ...openInvoice,
      lineItems: baseLineItems,
    };

    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => baseDraftInvoice,
      updateStatus: async () => finalizedInvoice,
      findOneWithLineItems: async () => finalizedInvoice,
    });

    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
    });

    const response = await finalizeInvoice(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('open');
    expect(response.body.paymentDueAt).not.toBeNull();
  });

  test('Admin captures payment -> status=paid, paidAt populated, paidBy set', async () => {
    let callCount = 0;
    const capturedInvoice = {
      ...paidInvoice,
      metadata: {
        stripePaymentIntentId: 'pi_test_123',
        providerDecision: 'capture',
        providerDecisionAt: new Date().toISOString(),
      },
    };

    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => {
        callCount++;
        return callCount === 1 ? openInvoice : capturedInvoice;
      },
      updateOneById: async () => capturedInvoice,
      findLineItemsByInvoiceIds: async () => new Map([[INVOICE_ID, baseLineItems]]),
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ id: MERCHANT_ID, email: 'merchant@test.com' }),
    });

    const ctx = makeCtx({
      user: { id: MERCHANT_ID, role: 'admin' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
      billing: fakeBilling,
    });

    const response = await captureInvoicePayment(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('paid');
    expect(response.body.paidAt).not.toBeNull();
  });

  test('Admin voids open invoice (within threshold) -> status=void, voidedAt populated', async () => {
    let callCount = 0;
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => {
        callCount++;
        return callCount === 1 ? openInvoice : voidedInvoice;
      },
      updateOneById: async () => voidedInvoice,
      findOneWithLineItems: async () => ({ ...voidedInvoice, lineItems: baseLineItems }),
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ id: MERCHANT_ID, email: 'merchant@test.com' }),
    });

    const ctx = makeCtx({
      user: { id: MERCHANT_ID, role: 'admin' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
      billing: fakeBilling,
    });

    const response = await voidInvoice(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('void');
    expect(response.body.voidedAt).not.toBeNull();
  });

  test('Cannot void invoice after voidThresholdMinutes passes -> VOID_THRESHOLD_EXCEEDED', async () => {
    // paidAt is 120 minutes ago, threshold is 60 minutes
    const expiredInvoice = {
      ...openInvoice,
      paidAt: new Date(Date.now() - 120 * 60 * 1000),
      voidThresholdMinutes: 60,
    };

    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => expiredInvoice,
      updateOneById: async () => voidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ id: MERCHANT_ID, email: 'merchant@test.com' }),
    });

    const ctx = makeCtx({
      user: { id: MERCHANT_ID, role: 'admin' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
      billing: fakeBilling,
    });

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    try {
      await voidInvoice(ctx);
    } catch (e: any) {
      expect(e.code).toBe('VOID_THRESHOLD_EXCEEDED');
    }
  });

  test('Cannot finalize already-open invoice -> INVALID_INVOICE_STATUS', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => openInvoice,
      findOneWithLineItems: async () => ({ ...openInvoice, lineItems: baseLineItems }),
    });

    const ctx = makeCtx({
      user: { id: ADMIN_ID, role: 'admin' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
    });

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(finalizeInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('Cannot void draft invoice -> requires_capture check fails', async () => {
    // Draft invoice has no paymentStatus (not requires_capture)
    const draftForVoid = {
      ...baseDraftInvoice,
      metadata: { stripePaymentIntentId: 'pi_test_123' },
      paymentStatus: null,
    };

    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => draftForVoid,
      updateOneById: async () => voidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ id: MERCHANT_ID, email: 'merchant@test.com' }),
    });

    const ctx = makeCtx({
      user: { id: MERCHANT_ID, role: 'admin' },
      logger: noopLogger,
      _params: { invoice: INVOICE_ID },
      billing: fakeBilling,
    });

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
