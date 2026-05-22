import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeBillingInvoice, fakePerson as createFakePerson, fakeMerchantAccount as createFakeMerchantAccount } from '@/test-utils/factories';
import { voidInvoice } from './voidInvoice';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeInvoice = fakeBillingInvoice({
  id: 'inv-1',
  invoiceNumber: 'INV-2025-000001',
  customer: 'person-customer',
  merchant: 'person-merchant',
  context: 'booking',
  status: 'open',
  subtotal: 10000,
  tax: 0,
  total: 10000,
  currency: 'PHP',
  paymentStatus: 'requires_capture',
  paymentDueAt: new Date(),
  paidAt: null,
  voidedAt: null,
  metadata: {
    stripePaymentIntentId: 'pi_test_123',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

const fakePerson = createFakePerson({
  id: 'person-merchant',
  email: 'merchant@test.com',
});

const fakeMerchantAccount = createFakeMerchantAccount({
  id: 'ma-1',
  person: 'person-merchant',
  active: true,
  metadata: { stripeAccountId: 'acct_test_456' },
});

const fakeVoidedInvoice = {
  ...fakeInvoice,
  status: 'void',
  paymentStatus: 'canceled',
  voidedAt: new Date(),
  metadata: {
    stripePaymentIntentId: 'pi_test_123',
    providerDecision: 'void',
    providerDecisionAt: new Date().toISOString(),
  },
};

const fakeBilling = {
  cancelPaymentIntent: async (_piId: string, _accountId: string, _reason: string) => ({
    id: 'pi_test_123',
    status: 'canceled',
  }),
};

// ─── Tests ──────────────────────────────────────────────

describe('voidInvoice', () => {
  let invoiceMocks: ReturnType<typeof stubRepo>;
  let merchantMocks: ReturnType<typeof stubRepo>;
  let personMocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (invoiceMocks) Object.values(invoiceMocks).forEach((m) => m.mockRestore());
    if (merchantMocks) Object.values(merchantMocks).forEach((m) => m.mockRestore());
    if (personMocks) Object.values(personMocks).forEach((m) => m.mockRestore());
  });

  function makeVoidCtx(overrides: Record<string, any> = {}) {
    return makeCtx({
      billing: fakeBilling,
      logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
      user: { id: 'person-merchant', role: 'user' },
      _params: { invoice: 'inv-1' },
      ...overrides,
    });
  }

  test('voids invoice and returns 200 with updated invoice data', async () => {
    let callCount = 0;
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => {
        callCount++;
        // First call: return the open invoice for validation checks.
        // Second call: return the voided invoice to build the response.
        return callCount === 1 ? fakeInvoice : fakeVoidedInvoice;
      },
      updateOneById: async () => fakeVoidedInvoice,
      findOneWithLineItems: async () => ({ ...fakeVoidedInvoice, lineItems: [] }),
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();
    const response = await voidInvoice(ctx);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('void');
    expect(response.body.paymentStatus).toBe('canceled');
  });

  test('admin can void any invoice without being the merchant', async () => {
    let callCount = 0;
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => {
        callCount++;
        return callCount === 1 ? fakeInvoice : fakeVoidedInvoice;
      },
      updateOneById: async () => fakeVoidedInvoice,
      findOneWithLineItems: async () => ({ ...fakeVoidedInvoice, lineItems: [] }),
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'admin-person', email: 'admin@test.com' }),
    });

    const ctx = makeVoidCtx({
      user: { id: 'admin-person', role: 'admin' },
    });

    const response = await voidInvoice(ctx);
    expect(response.status).toBe(200);
  });

  test('throws NotFoundError when invoice does not exist', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => null,
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();

    const { NotFoundError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when non-admin is not the merchant', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => fakeInvoice,
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => ({ id: 'other-person', email: 'other@test.com' }),
    });

    const ctx = makeVoidCtx({
      user: { id: 'other-person', role: 'user' },
    });

    const { ForbiddenError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws ConflictError when invoice is already voided (canceled)', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, paymentStatus: 'canceled' }),
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();

    const { ConflictError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws ConflictError when payment has already been captured (succeeded)', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, paymentStatus: 'succeeded' }),
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();

    const { ConflictError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws BusinessLogicError when payment is not in requires_capture state', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, paymentStatus: 'requires_payment_method' }),
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws ConflictError when provider decision already exists in metadata', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => ({
        ...fakeInvoice,
        metadata: {
          stripePaymentIntentId: 'pi_test_123',
          providerDecision: 'capture',
        },
      }),
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();

    const { ConflictError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws BusinessLogicError when no stripePaymentIntentId in metadata', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => ({
        ...fakeInvoice,
        metadata: {},
      }),
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => fakeMerchantAccount,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws NotFoundError when merchant account does not exist', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => fakeInvoice,
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => null,
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();

    const { NotFoundError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when merchant account has no stripeAccountId', async () => {
    invoiceMocks = stubRepo(InvoiceRepository, {
      findOneById: async () => fakeInvoice,
      updateOneById: async () => fakeVoidedInvoice,
    });
    merchantMocks = stubRepo(MerchantAccountRepository, {
      findByPerson: async () => ({ ...fakeMerchantAccount, metadata: {} }),
    });
    personMocks = stubRepo(PersonRepository, {
      findOneById: async () => fakePerson,
    });

    const ctx = makeVoidCtx();

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(voidInvoice(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
