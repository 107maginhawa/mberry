/**
 * Tests for handleStripeWebhook.ts handler.
 *
 * Strategy: build one Hono app per test, attach createErrorHandler so AppError
 * subclasses map to proper HTTP codes, and inject mock repos/services via
 * prototype restoration pattern (save → mock → restore in finally).
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { AppError } from '@/core/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INVOICE_ID = 'inv-uuid-aaaa-bbbb-cccc-dddddddddddd';
const PAYMENT_INTENT_ID = 'pi_test_12345';
const CHARGE_ID = 'ch_test_12345';
const TRANSFER_ID = 'tr_test_12345';
const STRIPE_ACCOUNT_ID = 'acct_test_67890';

function makeInvoice(overrides?: Record<string, any>) {
  return {
    id: INVOICE_ID,
    customer: 'cust-uuid',
    merchant: 'merch-uuid',
    invoiceNumber: 'INV-2026-000001',
    status: 'open',
    paymentStatus: 'pending',
    metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID },
    ...overrides,
  };
}

function makeMerchantAccount(overrides?: Record<string, any>) {
  return {
    id: 'ma-001',
    person: 'merch-uuid',
    active: true,
    metadata: { stripeAccountId: STRIPE_ACCOUNT_ID, onboardingComplete: true },
    ...overrides,
  };
}

function makeStripeEvent(type: string, dataObject: Record<string, any>, id = 'evt_test'): any {
  return { id, type, livemode: false, data: { object: dataObject }, created: Date.now() };
}

function makePaymentIntentObject(overrides?: Record<string, any>) {
  return {
    id: PAYMENT_INTENT_ID,
    object: 'payment_intent',
    amount: 10000,
    currency: 'usd',
    status: 'succeeded',
    metadata: { invoiceId: INVOICE_ID },
    last_payment_error: null,
    ...overrides,
  };
}

function makeChargeObject(overrides?: Record<string, any>) {
  return {
    id: CHARGE_ID,
    object: 'charge',
    payment_intent: PAYMENT_INTENT_ID,
    amount: 10000,
    currency: 'usd',
    status: 'succeeded',
    transfer: TRANSFER_ID,
    failure_code: null,
    failure_message: null,
    refunds: { data: [] },
    amount_refunded: 0,
    ...overrides,
  };
}

function makeAccountObject(overrides?: Record<string, any>) {
  return {
    id: STRIPE_ACCOUNT_ID,
    object: 'account',
    charges_enabled: true,
    payouts_enabled: true,
    requirements: { currently_due: [], disabled_reason: null },
    ...overrides,
  };
}

function makeNullLogger() {
  return { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
}

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

function attachErrorHandler(app: Hono) {
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ code: err.code, message: err.message }, err.statusCode as any);
    }
    return c.json({ code: 'INTERNAL_SERVER_ERROR', message: err.message }, 500);
  });
}

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildApp(deps: {
  verifySignature?: (rawBody: string, sig: string) => Promise<any>;
  invoiceById?: (id: string) => any;
  allInvoices?: any[];
  captureUpdate?: (id: string, data: any) => any;
  merchantAccountByStripeId?: (stripeId: string) => any;
  merchantAccountUpdateById?: (id: string, data: any) => any;
}) {
  const {
    verifySignature = async () => { throw new Error('not configured'); },
    invoiceById = () => makeInvoice(),
    allInvoices = [makeInvoice()],
    captureUpdate = async (id: string, data: any) => ({ ...makeInvoice(), ...data }),
    merchantAccountByStripeId = () => makeMerchantAccount(),
    merchantAccountUpdateById = async (id: string, data: any) => ({ ...makeMerchantAccount(), ...data }),
  } = deps;

  const { handleStripeWebhook } = await import('./handleStripeWebhook');
  const { InvoiceRepository } = await import('./repos/billing.repo');
  const { MerchantAccountRepository } = await import('./repos/billing.repo');

  const app = new Hono();
  attachErrorHandler(app);

  app.post('/', async (c) => {
    const logger = makeNullLogger();
    (c as any).set('logger', logger);

    const billing = { verifyWebhookSignature: verifySignature };
    (c as any).set('billing', billing);

    const notifs = { createNotification: async () => {} };
    (c as any).set('notifs', notifs);

    // Build a db mock with a chainable select that settles to allInvoices
    const selectChain: any = {};
    const selectMethods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy'];
    for (const m of selectMethods) selectChain[m] = () => selectChain;
    selectChain.then = (resolve: any, reject?: any) => Promise.resolve(allInvoices).then(resolve, reject);
    (c as any).set('database', { select: () => selectChain });

    // Patch InvoiceRepository prototype — save originals for restoration
    const origFindOneById = InvoiceRepository.prototype.findOneById;
    const origUpdateOneById = InvoiceRepository.prototype.updateOneById;

    InvoiceRepository.prototype.findOneById = async (id: string) => invoiceById(id);
    InvoiceRepository.prototype.updateOneById = captureUpdate;

    // Patch MerchantAccountRepository prototype
    const origMAFindByStripe = MerchantAccountRepository.prototype.findByStripeAccountId;
    const origMAUpdateById = MerchantAccountRepository.prototype.updateOneById;

    MerchantAccountRepository.prototype.findByStripeAccountId = async (id: string) =>
      merchantAccountByStripeId(id);
    MerchantAccountRepository.prototype.updateOneById = merchantAccountUpdateById;

    try {
      return await handleStripeWebhook(c as any);
    } finally {
      InvoiceRepository.prototype.findOneById = origFindOneById;
      InvoiceRepository.prototype.updateOneById = origUpdateOneById;
      MerchantAccountRepository.prototype.findByStripeAccountId = origMAFindByStripe;
      MerchantAccountRepository.prototype.updateOneById = origMAUpdateById;
    }
  });

  return app;
}

function postWebhook(app: Hono, body: string, signature = 'valid-sig') {
  return app.request('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  });
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — signature verification', () => {
  test('returns 400 when stripe-signature header is missing', async () => {
    const app = await buildApp({});

    const resp = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(resp.status).toBe(400);
    const body = await resp.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when signature verification throws', async () => {
    const app = await buildApp({
      verifySignature: async () => { throw new Error('Signature mismatch'); },
    });

    const resp = await postWebhook(app, '{"type":"unknown"}');
    expect(resp.status).toBe(400);
    const body = await resp.json() as any;
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// payment_intent.succeeded
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — payment_intent.succeeded', () => {
  test('updates invoice paymentStatus to requires_capture and returns 200', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject());
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      invoiceById: () => makeInvoice(),
      captureUpdate: async (id: string, data: any) => { captured = { id, data }; return makeInvoice(data); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.received).toBe(true);
    expect(captured?.data?.paymentStatus).toBe('requires_capture');
  });

  test('stores stripePaymentIntentId in invoice metadata', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject());
    let savedMeta: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      invoiceById: () => makeInvoice({ metadata: { previousKey: 'val' } }),
      captureUpdate: async (_id: string, data: any) => { savedMeta = data.metadata; return makeInvoice(data); },
    });

    await postWebhook(app, JSON.stringify(event));
    expect(savedMeta?.stripePaymentIntentId).toBe(PAYMENT_INTENT_ID);
    expect(savedMeta?.previousKey).toBe('val');
  });

  test('returns 200 and skips update when no invoiceId in metadata', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject({ metadata: {} }));
    let updated = false;

    const app = await buildApp({
      verifySignature: async () => event,
      captureUpdate: async () => { updated = true; return makeInvoice(); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(updated).toBe(false);
  });

  test('returns 200 when invoice not found', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject());

    const app = await buildApp({
      verifySignature: async () => event,
      invoiceById: () => null,
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — payment_intent.payment_failed', () => {
  test('updates paymentStatus to failed and returns 200', async () => {
    const event = makeStripeEvent('payment_intent.payment_failed', makePaymentIntentObject({ status: 'canceled' }));
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      invoiceById: () => makeInvoice(),
      captureUpdate: async (id: string, data: any) => { captured = { id, data }; return makeInvoice(data); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(captured?.data?.paymentStatus).toBe('failed');
  });

  test('returns 200 when no invoiceId in metadata', async () => {
    const event = makeStripeEvent('payment_intent.payment_failed', makePaymentIntentObject({ metadata: {} }));

    const app = await buildApp({ verifySignature: async () => event });
    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// payment_intent.canceled
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — payment_intent.canceled', () => {
  test('voids invoice and sets paymentStatus to canceled', async () => {
    const event = makeStripeEvent('payment_intent.canceled', makePaymentIntentObject());
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      captureUpdate: async (id: string, data: any) => { captured = { id, data }; return makeInvoice(data); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(captured?.data?.paymentStatus).toBe('canceled');
    expect(captured?.data?.status).toBe('void');
    expect(captured?.data?.voidedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// payment_intent.requires_action
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — payment_intent.requires_action', () => {
  test('sets paymentStatus to processing', async () => {
    const event = makeStripeEvent('payment_intent.requires_action', makePaymentIntentObject());
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      captureUpdate: async (id: string, data: any) => { captured = { id, data }; return makeInvoice(data); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(captured?.data?.paymentStatus).toBe('processing');
  });
});

// ---------------------------------------------------------------------------
// charge.succeeded
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — charge.succeeded', () => {
  test('marks invoice paid with charge+transfer metadata', async () => {
    const event = makeStripeEvent('charge.succeeded', makeChargeObject());
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      allInvoices: [makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } })],
      captureUpdate: async (id: string, data: any) => { captured = { id, data }; return makeInvoice(data); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(captured?.data?.paymentStatus).toBe('succeeded');
    expect(captured?.data?.status).toBe('paid');
    expect(captured?.data?.paidAt).toBeInstanceOf(Date);
    expect(captured?.data?.metadata?.stripeChargeId).toBe(CHARGE_ID);
    expect(captured?.data?.metadata?.stripeTransferId).toBe(TRANSFER_ID);
  });

  test('returns 200 with no update when no matching invoice in metadata', async () => {
    const event = makeStripeEvent('charge.succeeded', makeChargeObject());

    const app = await buildApp({
      verifySignature: async () => event,
      allInvoices: [],
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });

  test('returns 200 when charge has no payment_intent', async () => {
    const event = makeStripeEvent('charge.succeeded', makeChargeObject({ payment_intent: null }));

    const app = await buildApp({ verifySignature: async () => event });
    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// charge.failed
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — charge.failed', () => {
  test('sets paymentStatus to failed', async () => {
    const event = makeStripeEvent('charge.failed', makeChargeObject({ status: 'failed' }));
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      allInvoices: [makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } })],
      captureUpdate: async (id: string, data: any) => { captured = { id, data }; return makeInvoice(data); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(captured?.data?.paymentStatus).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// charge.refunded
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — charge.refunded', () => {
  test('stores full refund metadata on invoice', async () => {
    const event = makeStripeEvent('charge.refunded', makeChargeObject({
      amount: 10000,
      amount_refunded: 10000,
      refunds: { data: [{ id: 'ref_001', reason: 'requested_by_customer' }] },
    }));
    let savedMeta: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      allInvoices: [makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } })],
      captureUpdate: async (_id: string, data: any) => { savedMeta = data.metadata; return makeInvoice(data); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(savedMeta?.stripeRefundId).toBe('ref_001');
    expect(savedMeta?.refundStatus).toBe('full_refund');
  });

  test('marks partial_refund when amount_refunded < amount', async () => {
    const event = makeStripeEvent('charge.refunded', makeChargeObject({
      amount: 10000,
      amount_refunded: 5000,
      refunds: { data: [{ id: 'ref_002', reason: null }] },
    }));
    let savedMeta: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      allInvoices: [makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } })],
      captureUpdate: async (_id: string, data: any) => { savedMeta = data.metadata; return makeInvoice(data); },
    });

    await postWebhook(app, JSON.stringify(event));
    expect(savedMeta?.refundStatus).toBe('partial_refund');
    expect(savedMeta?.refundAmount).toBe('50.00');
  });
});

// ---------------------------------------------------------------------------
// account.updated
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — account.updated', () => {
  test('updates merchant account metadata with active status', async () => {
    const event = makeStripeEvent('account.updated', makeAccountObject());
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      merchantAccountByStripeId: () => makeMerchantAccount(),
      merchantAccountUpdateById: async (id: string, data: any) => { captured = { id, data }; return makeMerchantAccount(); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(captured?.data?.metadata?.stripeAccountStatus).toBe('active');
    expect(captured?.data?.metadata?.onboardingComplete).toBe(true);
  });

  test('sets status to restricted when disabled_reason present', async () => {
    const event = makeStripeEvent('account.updated', makeAccountObject({
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: ['id.document'], disabled_reason: 'requirements.past_due' },
    }));
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      merchantAccountByStripeId: () => makeMerchantAccount(),
      merchantAccountUpdateById: async (id: string, data: any) => { captured = { id, data }; return makeMerchantAccount(); },
    });

    await postWebhook(app, JSON.stringify(event));
    expect(captured?.data?.metadata?.stripeAccountStatus).toBe('restricted');
    expect(captured?.data?.metadata?.onboardingComplete).toBe(false);
  });

  test('sets status to pending when neither active nor disabled', async () => {
    const event = makeStripeEvent('account.updated', makeAccountObject({
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: [], disabled_reason: null },
    }));
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      merchantAccountByStripeId: () => makeMerchantAccount(),
      merchantAccountUpdateById: async (id: string, data: any) => { captured = { id, data }; return makeMerchantAccount(); },
    });

    await postWebhook(app, JSON.stringify(event));
    expect(captured?.data?.metadata?.stripeAccountStatus).toBe('pending');
  });

  test('returns 200 when no merchant account found', async () => {
    const event = makeStripeEvent('account.updated', makeAccountObject());

    const app = await buildApp({
      verifySignature: async () => event,
      merchantAccountByStripeId: () => null,
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// account.application.deauthorized
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — account.application.deauthorized', () => {
  test('deactivates merchant account and sets deauthorizedAt', async () => {
    const event = makeStripeEvent('account.application.deauthorized', { account: STRIPE_ACCOUNT_ID });
    let captured: any = null;

    const app = await buildApp({
      verifySignature: async () => event,
      merchantAccountByStripeId: () => makeMerchantAccount(),
      merchantAccountUpdateById: async (id: string, data: any) => { captured = { id, data }; return makeMerchantAccount(); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    expect(captured?.data?.active).toBe(false);
    expect(captured?.data?.metadata?.stripeAccountStatus).toBe('restricted');
    expect(typeof captured?.data?.metadata?.deauthorizedAt).toBe('string');
  });

  test('returns 200 when no merchant account found', async () => {
    const event = makeStripeEvent('account.application.deauthorized', { account: STRIPE_ACCOUNT_ID });

    const app = await buildApp({
      verifySignature: async () => event,
      merchantAccountByStripeId: () => null,
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// transfer.created
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — transfer.created', () => {
  test('returns 200 when transfer matches invoice', async () => {
    const event = makeStripeEvent('transfer.created', { id: TRANSFER_ID, object: 'transfer', amount: 10000 });

    const app = await buildApp({
      verifySignature: async () => event,
      allInvoices: [makeInvoice({ metadata: { stripeTransferId: TRANSFER_ID } })],
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });

  test('returns 200 when no invoice found for transfer', async () => {
    const event = makeStripeEvent('transfer.created', { id: TRANSFER_ID, object: 'transfer', amount: 10000 });

    const app = await buildApp({
      verifySignature: async () => event,
      allInvoices: [],
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Unknown / unhandled event types
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — unknown event types', () => {
  test('returns 200 received:true for unhandled event type', async () => {
    const event = makeStripeEvent('invoice.created', { id: 'inv_stripe_obj' });

    const app = await buildApp({ verifySignature: async () => event });
    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    const body = await resp.json() as any;
    expect(body.received).toBe(true);
  });

  test('returns 200 for completely arbitrary event type', async () => {
    const event = makeStripeEvent('totally.unknown.event.xyz', {});

    const app = await buildApp({ verifySignature: async () => event });
    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
  });
});
