import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeBillingInvoice, fakePerson as createFakePerson } from '@/test-utils/factories';
import { InvoiceRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { markInvoiceUncollectible } from './markInvoiceUncollectible';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

const MERCHANT_ID = 'merch-1';
const INVOICE_ID = 'inv-1';

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({ user, session: { id: 's-1', userId, user }, logger: fakeLogger, ...extraOverrides });
}

const openInvoice = fakeBillingInvoice({
  id: INVOICE_ID, invoiceNumber: 'INV-2026-001',
  merchant: MERCHANT_ID, customer: 'cust-1',
  status: 'open', total: 1000, currency: 'PHP',
  paymentStatus: null, paidAt: null,
  createdAt: new Date(), updatedAt: new Date(),
});

const fakePerson = createFakePerson({ id: MERCHANT_ID, email: 'merch@example.com', userId: MERCHANT_ID });

describe('markInvoiceUncollectible', () => {
  beforeEach(() => {
    restoreRepo(InvoiceRepository);
    restoreRepo(PersonRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => openInvoice,
      updateStatus: async () => ({ ...openInvoice, status: 'uncollectible' }),
    });
    stubRepo(PersonRepository, { findOneById: async () => fakePerson });
  });

  afterEach(() => {
    restoreRepo(InvoiceRepository);
    restoreRepo(PersonRepository);
  });

  test('returns 200 when merchant marks open invoice as uncollectible', async () => {
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID } });
    const res = await markInvoiceUncollectible(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.status).toBe('uncollectible');
  });

  test('throws NotFoundError when invoice not found', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => null,
      updateStatus: async () => openInvoice,
    });
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: 'nonexistent' } });
    await expect(markInvoiceUncollectible(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when invoice is not open', async () => {
    restoreRepo(InvoiceRepository);
    stubRepo(InvoiceRepository, {
      findOneById: async () => ({ ...openInvoice, status: 'draft' }),
      updateStatus: async () => openInvoice,
    });
    const ctx = makeBillingCtx(MERCHANT_ID, 'provider', { _params: { invoice: INVOICE_ID } });
    await expect(markInvoiceUncollectible(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
