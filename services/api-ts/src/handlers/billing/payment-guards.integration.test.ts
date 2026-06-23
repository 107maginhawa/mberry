/**
 * [BR-60][BR-61][BR-63][BR-64] Billing money-movement guards (real PG).
 *
 * p0-data. These guards protect money movement and were backend-tested only with
 * mocked repos. Every guard in payInvoice / captureInvoicePayment /
 * refundInvoicePayment fires BEFORE the handler ever calls Stripe, so they are
 * fully provable against persisted rows with NO Stripe: this suite seeds invoices
 * / merchant accounts in precise states via createScratch and drives the REAL
 * handlers, asserting each guard rejects the bad operation.
 *
 * To prove a guard rejects BEFORE reaching the gateway, `billing` is a stub that
 * throws if any Stripe method is called — so a missing guard surfaces as the
 * wrong error, not a false pass.
 *
 * The Stripe happy-path transitions (open→paid on capture, webhook-driven paid)
 * require stripe-mock, which is not wired in CI; they stay in the gated
 * billing-lifecycle.hurl + handleStripeWebhook.test.ts.
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';
import { BusinessLogicError, NotFoundError, ConflictError } from '@/core/errors';
import { payInvoice } from './payInvoice';
import { captureInvoicePayment } from './captureInvoicePayment';
import { refundInvoicePayment } from './refundInvoicePayment';

let H: ScratchDb;
const ORG = '00000000-0000-4000-8000-0000000b6001';

beforeAll(async () => {
  H = await createScratch(['invoice', 'merchant_account', 'person']);
});
afterAll(async () => {
  await H?.teardown();
});

function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {}, info: () => {}, warn: () => {}, error: () => {},
  };
  l['child'] = () => l;
  return l;
}

// A billing stub that explodes if a guard fails to reject before Stripe.
const billingTrap = new Proxy({}, {
  get() {
    return async () => { throw new Error('STRIPE_SHOULD_NOT_BE_CALLED — a guard failed to reject'); };
  },
});

interface CtxOpts { userId: string; role?: string; invoiceId: string; json?: unknown }
function makeCtx(o: CtxOpts) {
  const store: Record<string, unknown> = {
    session: { user: { id: o.userId, role: o.role ?? 'user' } },
    database: H.db,
    logger: makeLogger(),
    billing: billingTrap,
    requestId: 't',
  };
  const ctx = {
    get: (k: string) => store[k],
    set: () => {},
    req: { valid: (kind: 'param' | 'json') => (kind === 'param' ? { invoice: o.invoiceId } : (o.json ?? {})) },
    json: (b: unknown, status: number) => new Response(JSON.stringify(b), { status }),
  };
  return ctx as never;
}

async function seedPerson(id: string): Promise<void> {
  await H.scopedPool.query(`INSERT INTO "${H.schema}".person (id, first_name) VALUES ($1,'P')`, [id]);
}
async function seedMerchant(person: string, metadata: Record<string, unknown>): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".merchant_account (id, person, active, metadata) VALUES ($1,$2,true,$3::jsonb)`,
    [crypto.randomUUID(), person, JSON.stringify(metadata)],
  );
}
interface InvoiceOpts { customer: string; merchant: string; status: string; paymentStatus?: string; metadata?: Record<string, unknown> }
async function seedInvoice(o: InvoiceOpts): Promise<string> {
  const id = crypto.randomUUID();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".invoice
       (id, invoice_number, customer, merchant, status, subtotal, total, currency, payment_capture_method, organization_id, payment_status, metadata)
     VALUES ($1,$2,$3,$4,$5,1000,1000,'PHP','manual',$6,$7,$8::jsonb)`,
    [id, `INV-${id.slice(0, 8)}`, o.customer, o.merchant, o.status, ORG, o.paymentStatus ?? null,
      o.metadata ? JSON.stringify(o.metadata) : null],
  );
  return id;
}

const ONBOARDED = { stripeAccountId: 'acct_test', onboardingComplete: true };

describe('[BR-61] terminal-state guard — payInvoice only pays `open` invoices', () => {
  for (const status of ['paid', 'void', 'uncollectible', 'draft']) {
    test(`paying a ${status} invoice is rejected (not payable)`, async () => {
      if (!H.dbReachable) return;
      const customer = crypto.randomUUID(); const merchant = crypto.randomUUID();
      await seedPerson(customer); await seedMerchant(merchant, ONBOARDED);
      const inv = await seedInvoice({ customer, merchant, status });
      await expect(
        payInvoice(makeCtx({ userId: customer, invoiceId: inv })),
      ).rejects.toThrow(/not payable/i);
    });
  }

  test('open invoice with an in-progress payment is a 409 (no double-charge)', async () => {
    if (!H.dbReachable) return;
    const customer = crypto.randomUUID(); const merchant = crypto.randomUUID();
    await seedPerson(customer); await seedMerchant(merchant, ONBOARDED);
    const inv = await seedInvoice({ customer, merchant, status: 'open', paymentStatus: 'processing' });
    await expect(
      payInvoice(makeCtx({ userId: customer, invoiceId: inv })),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('[BR-60] merchant-account-required — payInvoice needs an onboarded merchant', () => {
  test('open invoice with NO merchant account → not found', async () => {
    if (!H.dbReachable) return;
    const customer = crypto.randomUUID(); const merchant = crypto.randomUUID();
    await seedPerson(customer); // merchant has no merchant_account row
    const inv = await seedInvoice({ customer, merchant, status: 'open' });
    await expect(
      payInvoice(makeCtx({ userId: customer, invoiceId: inv })),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('merchant present but onboarding incomplete → rejected before Stripe', async () => {
    if (!H.dbReachable) return;
    const customer = crypto.randomUUID(); const merchant = crypto.randomUUID();
    await seedPerson(customer);
    await seedMerchant(merchant, { stripeAccountId: 'acct_x', onboardingComplete: false });
    const inv = await seedInvoice({ customer, merchant, status: 'open' });
    await expect(
      payInvoice(makeCtx({ userId: customer, invoiceId: inv })),
    ).rejects.toThrow(/billing setup/i);
  });
});

describe('[BR-64] refund-requires-captured — refundInvoicePayment only refunds succeeded payments', () => {
  for (const paymentStatus of [undefined, 'pending', 'requires_capture', 'failed']) {
    test(`refunding a payment in status=${paymentStatus ?? 'none'} is rejected`, async () => {
      if (!H.dbReachable) return;
      const customer = crypto.randomUUID(); const merchant = crypto.randomUUID();
      await seedMerchant(merchant, ONBOARDED);
      const inv = await seedInvoice({ customer, merchant, status: 'open', paymentStatus });
      // admin bypasses the owner-authz branch so we reach the capture-state guard.
      await expect(
        refundInvoicePayment(makeCtx({ userId: 'admin-1', role: 'admin', invoiceId: inv, json: {} })),
      ).rejects.toThrow(/captured before it can be refunded/i);
    });
  }

  test('already-refunded payment → 409', async () => {
    if (!H.dbReachable) return;
    const customer = crypto.randomUUID(); const merchant = crypto.randomUUID();
    await seedMerchant(merchant, ONBOARDED);
    const inv = await seedInvoice({
      customer, merchant, status: 'paid', paymentStatus: 'succeeded',
      metadata: { stripePaymentIntentId: 'pi_x', stripeChargeId: 'ch_x', refundStatus: 'full_refund', refundAmount: '10.00' },
    });
    await expect(
      refundInvoicePayment(makeCtx({ userId: 'admin-1', role: 'admin', invoiceId: inv, json: {} })),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('[BR-63] capture authorization guard — captureInvoicePayment requires an authorized payment', () => {
  test('capturing a payment that is not in requires_capture is rejected', async () => {
    if (!H.dbReachable) return;
    const customer = crypto.randomUUID(); const merchant = crypto.randomUUID();
    await seedMerchant(merchant, ONBOARDED);
    const inv = await seedInvoice({ customer, merchant, status: 'open', paymentStatus: 'pending' });
    await expect(
      captureInvoicePayment(makeCtx({ userId: 'admin-1', role: 'admin', invoiceId: inv })),
    ).rejects.toThrow(/authorized .*to capture/i);
  });

  test('capturing an already-succeeded payment → 409 (no re-capture)', async () => {
    if (!H.dbReachable) return;
    const customer = crypto.randomUUID(); const merchant = crypto.randomUUID();
    await seedMerchant(merchant, ONBOARDED);
    const inv = await seedInvoice({ customer, merchant, status: 'paid', paymentStatus: 'succeeded' });
    await expect(
      captureInvoicePayment(makeCtx({ userId: 'admin-1', role: 'admin', invoiceId: inv })),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
