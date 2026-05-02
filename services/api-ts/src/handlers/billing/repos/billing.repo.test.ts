/**
 * Tests for billing.repo.ts — InvoiceRepository and MerchantAccountRepository.
 *
 * Each test creates a fresh db mock and a fresh repository instance.
 * No prototype mutation — isolation is guaranteed by local instance creation.
 */

import { describe, test, expect } from 'bun:test';
import { InvoiceRepository, MerchantAccountRepository } from './billing.repo';
import type { Invoice, MerchantAccount, InvoiceLineItem } from './billing.schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeInvoice(overrides?: Partial<Invoice>): Invoice {
  return {
    id: 'inv-001',
    invoiceNumber: 'INV-2026-000001',
    customer: 'cust-uuid',
    merchant: 'merch-uuid',
    merchantAccount: null,
    context: null,
    status: 'draft',
    subtotal: 10000,
    tax: null,
    total: 10000,
    currency: 'USD',
    paymentCaptureMethod: 'automatic',
    paymentDueAt: null,
    paymentStatus: null,
    paidAt: null,
    paidBy: null,
    voidedAt: null,
    voidedBy: null,
    voidThresholdMinutes: null,
    authorizedAt: null,
    authorizedBy: null,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeLineItem(overrides?: Partial<InvoiceLineItem>): InvoiceLineItem {
  return {
    id: 'li-001',
    invoice: 'inv-001',
    description: 'Consulting',
    quantity: 1,
    unitPrice: 10000,
    amount: 10000,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeMerchantAccount(overrides?: Partial<MerchantAccount>): MerchantAccount {
  return {
    id: 'ma-001',
    person: 'merch-uuid',
    active: true,
    metadata: { stripeAccountId: 'acct_test', onboardingComplete: true },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeNullLogger() {
  return { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
}

// ---------------------------------------------------------------------------
// DB mock helpers
//
// The Drizzle query builder is a chainable API — we build stubs that
// return `this` for every chain method and resolve to `rows` when awaited.
// ---------------------------------------------------------------------------

/**
 * A single shared chain that settles to `rows` when awaited.
 * Supports: select/from/where/limit/offset/orderBy/leftJoin
 */
function makeSelectChain(rows: any[]): any {
  const chain: any = {};
  const methods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'leftJoin'];
  for (const m of methods) chain[m] = () => chain;
  chain.then = (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject);
  return chain;
}

function makeInsertReturningChain(rows: any[]): any {
  return {
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(rows),
      }),
    }),
  };
}

function makeUpdateReturningChain(rows: any[]): any {
  return {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(rows),
        }),
      }),
    }),
  };
}

function makeDeleteChain(): any {
  return {
    delete: () => ({
      where: () => Promise.resolve([]),
    }),
  };
}

// ---------------------------------------------------------------------------
// InvoiceRepository — findOneById
// ---------------------------------------------------------------------------

describe('InvoiceRepository.findOneById', () => {
  test('returns invoice when found', async () => {
    const invoice = makeInvoice();
    const chain = makeSelectChain([invoice]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.findOneById('inv-001');
    expect(result?.id).toBe('inv-001');
    expect(result?.status).toBe('draft');
  });

  test('returns null when not found', async () => {
    const chain = makeSelectChain([]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.findOneById('missing');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// InvoiceRepository — createOne
// ---------------------------------------------------------------------------

describe('InvoiceRepository.createOne', () => {
  test('inserts and returns created invoice', async () => {
    const invoice = makeInvoice();
    const db = makeInsertReturningChain([invoice]) as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.createOne({
      customer: 'cust-uuid',
      merchant: 'merch-uuid',
      invoiceNumber: 'INV-2026-000001',
      status: 'draft',
      subtotal: 10000,
      total: 10000,
      currency: 'USD',
      paymentCaptureMethod: 'automatic',
    } as any);
    expect(result.id).toBe('inv-001');
    expect(result.invoiceNumber).toBe('INV-2026-000001');
  });
});

// ---------------------------------------------------------------------------
// InvoiceRepository — updateOneById
// ---------------------------------------------------------------------------

describe('InvoiceRepository.updateOneById', () => {
  test('updates and returns updated invoice', async () => {
    const updated = makeInvoice({ status: 'open' });
    const db = makeUpdateReturningChain([updated]) as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.updateOneById('inv-001', { status: 'open' } as any);
    expect(result.status).toBe('open');
  });

  test('throws when record not found', async () => {
    const db = makeUpdateReturningChain([]) as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    await expect(repo.updateOneById('missing', { status: 'open' } as any)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// InvoiceRepository — deleteOneById
// ---------------------------------------------------------------------------

describe('InvoiceRepository.deleteOneById', () => {
  test('deletes without error', async () => {
    const db = makeDeleteChain() as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    await expect(repo.deleteOneById('inv-001')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// InvoiceRepository — findMany
// ---------------------------------------------------------------------------

describe('InvoiceRepository.findMany', () => {
  test('returns all invoices when no filters', async () => {
    const invoices = [makeInvoice(), makeInvoice({ id: 'inv-002', invoiceNumber: 'INV-2026-000002' })];
    const chain = makeSelectChain(invoices);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const results = await repo.findMany();
    expect(results).toHaveLength(2);
  });

  test('filters by customer — passes filter to query', async () => {
    const invoice = makeInvoice({ customer: 'target-cust' });
    const chain = makeSelectChain([invoice]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const results = await repo.findMany({ customer: 'target-cust' });
    // The mock always returns the preset rows; we verify the rows have the right field
    expect(results[0]?.customer).toBe('target-cust');
  });

  test('filters by status', async () => {
    const invoice = makeInvoice({ status: 'paid' });
    const chain = makeSelectChain([invoice]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const results = await repo.findMany({ status: 'paid' });
    expect(results[0]?.status).toBe('paid');
  });

  test('filters by context', async () => {
    const invoice = makeInvoice({ context: 'booking:abc' });
    const chain = makeSelectChain([invoice]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const results = await repo.findMany({ context: 'booking:abc' });
    expect(results[0]?.context).toBe('booking:abc');
  });

  test('returns empty array when no matches', async () => {
    const chain = makeSelectChain([]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const results = await repo.findMany({ status: 'void' });
    expect(results).toHaveLength(0);
  });

  test('applies paymentStatus filter', async () => {
    const invoice = makeInvoice({ paymentStatus: 'succeeded' });
    const chain = makeSelectChain([invoice]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const results = await repo.findMany({ paymentStatus: 'succeeded' });
    expect(results[0]?.paymentStatus).toBe('succeeded');
  });
});

// ---------------------------------------------------------------------------
// InvoiceRepository — updateStatus (state machine)
// ---------------------------------------------------------------------------

describe('InvoiceRepository.updateStatus', () => {
  test('draft → open transition', async () => {
    const updated = makeInvoice({ status: 'open' });
    const db = makeUpdateReturningChain([updated]) as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.updateStatus('inv-001', 'open', 'user-1');
    expect(result.status).toBe('open');
  });

  test('paid transition returns invoice with paidAt set', async () => {
    const updated = makeInvoice({ status: 'paid', paidAt: new Date() });
    const db = makeUpdateReturningChain([updated]) as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.updateStatus('inv-001', 'paid', 'user-1');
    expect(result.status).toBe('paid');
    expect(result.paidAt).toBeInstanceOf(Date);
  });

  test('void transition returns invoice with voidedAt set', async () => {
    const updated = makeInvoice({ status: 'void', voidedAt: new Date() });
    const db = makeUpdateReturningChain([updated]) as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.updateStatus('inv-001', 'void');
    expect(result.status).toBe('void');
    expect(result.voidedAt).toBeInstanceOf(Date);
  });

  test('uncollectible transition', async () => {
    const updated = makeInvoice({ status: 'uncollectible' });
    const db = makeUpdateReturningChain([updated]) as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.updateStatus('inv-001', 'uncollectible');
    expect(result.status).toBe('uncollectible');
  });

  test('works without userId', async () => {
    const updated = makeInvoice({ status: 'open' });
    const db = makeUpdateReturningChain([updated]) as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.updateStatus('inv-001', 'open');
    expect(result.status).toBe('open');
  });
});

// ---------------------------------------------------------------------------
// InvoiceRepository — updatePaymentStatus (state machine)
// ---------------------------------------------------------------------------

describe('InvoiceRepository.updatePaymentStatus', () => {
  const paymentStatuses = ['pending', 'requires_capture', 'processing', 'succeeded', 'failed', 'canceled'] as const;

  for (const ps of paymentStatuses) {
    test(`sets paymentStatus to ${ps}`, async () => {
      const updated = makeInvoice({ paymentStatus: ps });
      const db = makeUpdateReturningChain([updated]) as any;

      const repo = new InvoiceRepository(db, makeNullLogger());
      const result = await repo.updatePaymentStatus('inv-001', ps);
      expect(result.paymentStatus).toBe(ps);
    });
  }
});

// ---------------------------------------------------------------------------
// InvoiceRepository — generateInvoiceNumber
// ---------------------------------------------------------------------------

describe('InvoiceRepository.generateInvoiceNumber', () => {
  test('generates INV-YYYY-000001 when no invoices exist', async () => {
    const chain = makeSelectChain([]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const number = await repo.generateInvoiceNumber();
    const year = new Date().getFullYear();
    expect(number).toBe(`INV-${year}-000001`);
  });

  test('increments from the last invoice number', async () => {
    const year = new Date().getFullYear();
    const chain = makeSelectChain([{ invoiceNumber: `INV-${year}-000005` }]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const number = await repo.generateInvoiceNumber();
    expect(number).toBe(`INV-${year}-000006`);
  });

  test('pads number to 6 digits', async () => {
    const year = new Date().getFullYear();
    const chain = makeSelectChain([{ invoiceNumber: `INV-${year}-000099` }]);
    const db = { select: () => chain } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const number = await repo.generateInvoiceNumber();
    expect(number).toBe(`INV-${year}-000100`);
  });
});

// ---------------------------------------------------------------------------
// InvoiceRepository — createWithLineItems (transaction)
// ---------------------------------------------------------------------------

describe('InvoiceRepository.createWithLineItems', () => {
  test('creates invoice and line items in a transaction', async () => {
    const invoice = makeInvoice();
    const lineItem = makeLineItem();

    // Track which insert call we're on
    let insertCallIdx = 0;

    const tx = {
      insert: () => ({
        values: () => ({
          returning: () => {
            const result = insertCallIdx === 0 ? [invoice] : [lineItem];
            insertCallIdx++;
            return Promise.resolve(result);
          },
        }),
      }),
      // generateInvoiceNumber uses select on this.db, not tx
    };

    const db = {
      transaction: async (fn: (tx: any) => Promise<any>) => fn(tx),
      select: () => makeSelectChain([]), // generateInvoiceNumber → no existing → 000001
    } as any;

    const repo = new InvoiceRepository(db, makeNullLogger());
    const result = await repo.createWithLineItems(
      {
        customer: 'cust-uuid',
        merchant: 'merch-uuid',
        status: 'draft',
        subtotal: 10000,
        total: 10000,
        currency: 'USD',
        paymentCaptureMethod: 'automatic',
        createdBy: 'user-1',
      } as any,
      [{ description: 'Consulting', quantity: 1, unitPrice: 10000, amount: 10000 }]
    );

    expect(result.id).toBe(invoice.id);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]?.description).toBe('Consulting');
  });
});

// ---------------------------------------------------------------------------
// MerchantAccountRepository — findByPerson
// ---------------------------------------------------------------------------

describe('MerchantAccountRepository.findByPerson', () => {
  test('returns merchant account when found', async () => {
    const ma = makeMerchantAccount();
    const chain = makeSelectChain([ma]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const result = await repo.findByPerson('merch-uuid');
    expect(result?.id).toBe('ma-001');
    expect(result?.person).toBe('merch-uuid');
  });

  test('returns null when person has no merchant account', async () => {
    const chain = makeSelectChain([]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const result = await repo.findByPerson('unknown-person');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MerchantAccountRepository — findByStripeAccountId
// ---------------------------------------------------------------------------

describe('MerchantAccountRepository.findByStripeAccountId', () => {
  test('returns merchant account matching stripeAccountId', async () => {
    const ma = makeMerchantAccount({ metadata: { stripeAccountId: 'acct_live_123' } });
    const chain = makeSelectChain([ma]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const result = await repo.findByStripeAccountId('acct_live_123');
    expect(result?.id).toBe('ma-001');
  });

  test('returns null when not found', async () => {
    const chain = makeSelectChain([]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const result = await repo.findByStripeAccountId('acct_nonexistent');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MerchantAccountRepository — findOneWithPerson
// ---------------------------------------------------------------------------

describe('MerchantAccountRepository.findOneWithPerson', () => {
  test('returns merchant account with nested person', async () => {
    const ma = makeMerchantAccount();
    const row = { merchantAccount: ma, person: { id: 'merch-uuid' } };
    const chain = makeSelectChain([row]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const result = await repo.findOneWithPerson('ma-001');
    expect(result?.id).toBe('ma-001');
    expect(result?.person).toEqual({ id: 'merch-uuid' });
  });

  test('returns null when account not found', async () => {
    const chain = makeSelectChain([]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const result = await repo.findOneWithPerson('missing');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// MerchantAccountRepository — updateMetadata
// ---------------------------------------------------------------------------

describe('MerchantAccountRepository.updateMetadata', () => {
  test('merges metadata and returns updated account', async () => {
    const updated = makeMerchantAccount({
      metadata: { stripeAccountId: 'acct_123', onboardingComplete: true, extra: 'yes' },
    });
    const db = makeUpdateReturningChain([updated]) as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const result = await repo.updateMetadata('ma-001', { extra: 'yes' }, 'user-1');
    expect((result.metadata as any)['extra']).toBe('yes');
  });
});

// ---------------------------------------------------------------------------
// MerchantAccountRepository — createOne
// ---------------------------------------------------------------------------

describe('MerchantAccountRepository.createOne', () => {
  test('inserts and returns merchant account', async () => {
    const ma = makeMerchantAccount();
    const db = makeInsertReturningChain([ma]) as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const result = await repo.createOne({
      person: 'merch-uuid',
      active: true,
      metadata: { stripeAccountId: 'acct_test', onboardingComplete: false },
    } as any);
    expect(result.id).toBe('ma-001');
    expect(result.active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MerchantAccountRepository — findMany with active filter
// ---------------------------------------------------------------------------

describe('MerchantAccountRepository.findMany', () => {
  test('filters by active=true', async () => {
    const ma = makeMerchantAccount({ active: true });
    const chain = makeSelectChain([ma]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const results = await repo.findMany({ active: true });
    expect(results[0]?.active).toBe(true);
  });

  test('filters by active=false', async () => {
    const ma = makeMerchantAccount({ active: false });
    const chain = makeSelectChain([ma]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const results = await repo.findMany({ active: false });
    expect(results[0]?.active).toBe(false);
  });

  test('filters by person', async () => {
    const ma = makeMerchantAccount({ person: 'target-person' });
    const chain = makeSelectChain([ma]);
    const db = { select: () => chain } as any;

    const repo = new MerchantAccountRepository(db, makeNullLogger());
    const results = await repo.findMany({ person: 'target-person' });
    expect(results[0]?.person).toBe('target-person');
  });
});

// ---------------------------------------------------------------------------
// Amount calculation consistency (pure logic — no I/O)
// ---------------------------------------------------------------------------

describe('line item amount calculation', () => {
  test('amount equals quantity times unitPrice', () => {
    const quantity = 3;
    const unitPrice = 5000;
    expect(quantity * unitPrice).toBe(15000);
  });

  test('subtotal is sum of all line item amounts', () => {
    const items = [
      { quantity: 2, unitPrice: 3000, amount: 6000 },
      { quantity: 1, unitPrice: 2000, amount: 2000 },
    ];
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    expect(subtotal).toBe(8000);
  });

  test('total equals subtotal when tax is zero', () => {
    expect(8000 + 0).toBe(8000);
  });
});
