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
// invoices.organization_id is a notNull uuid column — every invoice the webhook
// loads carries one. Notifications created off an invoice must propagate it.
const ORG_ID = 'org-uuid-1111-2222-3333-444444444444';

function makeInvoice(overrides?: Record<string, any>) {
  return {
    id: INVOICE_ID,
    organizationId: ORG_ID,
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
  // Subscription lifecycle (UJ-M03): row returned by db.select(subscriptions),
  // and a sink that captures the data passed to db.update(subscriptions).set().
  subscriptionRow?: any;
  subscriptionUpdateSink?: { set?: any };
}) {
  const {
    verifySignature = async () => { throw new Error('not configured'); },
    invoiceById = () => makeInvoice(),
    allInvoices = [makeInvoice()],
    captureUpdate = async (id: string, data: any) => ({ ...makeInvoice(), ...data }),
    merchantAccountByStripeId = () => makeMerchantAccount(),
    merchantAccountUpdateById = async (id: string, data: any) => ({ ...makeMerchantAccount(), ...data }),
    subscriptionRow = null,
    subscriptionUpdateSink,
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
    const selectMethods = ['select', 'from', 'where', 'offset', 'orderBy'];
    for (const m of selectMethods) selectChain[m] = () => selectChain;
    // Subscription lifecycle handlers issue `.limit(1)` reads — return the
    // injected subscription row there; everything else settles to allInvoices.
    // Subscription `.limit(1)` lookups return the injected row, or [] when none
    // is injected (mirrors a real no-match db read — never the invoice list).
    selectChain.limit = async () => (subscriptionRow ? [subscriptionRow] : []);
    selectChain.then = (resolve: any, reject?: any) => Promise.resolve(allInvoices).then(resolve, reject);
    // Subscription handlers also call db.update(subscriptions).set(data).where().
    const updateChain: any = {
      set: (data: any) => {
        if (subscriptionUpdateSink) subscriptionUpdateSink.set = data;
        return updateChain;
      },
      where: () => updateChain,
      returning: async () => [subscriptionRow ? { ...subscriptionRow } : {}],
      then: (resolve: any, reject?: any) => Promise.resolve(undefined).then(resolve, reject),
    };
    (c as any).set('database', { select: () => selectChain, update: () => updateChain });

    // Patch InvoiceRepository prototype — save originals for restoration
    const origFindOneById = InvoiceRepository.prototype.findOneById;
    const origUpdateOneById = InvoiceRepository.prototype.updateOneById;
    // FIX-002: webhook handlers now correlate via indexed JSONB lookups, not
    // a findAll() scan. Patch those methods with predicate-aware mocks so the
    // tests prove the correct lookup path (and can't fake-green a 500-row scan).
    const origFindByPI = InvoiceRepository.prototype.findByStripePaymentIntentId;
    const origFindByTransfer = InvoiceRepository.prototype.findByStripeTransferId;

    InvoiceRepository.prototype.findOneById = async (id: string) => invoiceById(id);
    InvoiceRepository.prototype.updateOneById = captureUpdate;
    InvoiceRepository.prototype.findByStripePaymentIntentId = async (pi: string) =>
      allInvoices.find((inv: any) => (inv.metadata as any)?.stripePaymentIntentId === pi) ?? null;
    InvoiceRepository.prototype.findByStripeTransferId = async (tr: string) =>
      allInvoices.filter((inv: any) => (inv.metadata as any)?.stripeTransferId === tr);

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
      InvoiceRepository.prototype.findByStripePaymentIntentId = origFindByPI;
      InvoiceRepository.prototype.findByStripeTransferId = origFindByTransfer;
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

  // FIX-002 regression: correlate the invoice even when it is well beyond the
  // first 500 rows. The old findAll()+limit(500) scan silently dropped this
  // charge — money captured, invoice never marked paid. The indexed lookup
  // must find it regardless of position.
  test('marks invoice paid even when it is beyond the old 500-row scan window', async () => {
    const event = makeStripeEvent('charge.succeeded', makeChargeObject());
    let captured: any = null;

    // 600 non-matching invoices, then the matching one at index 600.
    const noise = Array.from({ length: 600 }, (_, i) =>
      makeInvoice({ id: `noise-${i}`, metadata: { stripePaymentIntentId: `pi_other_${i}` } })
    );
    const target = makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } });

    const app = await buildApp({
      verifySignature: async () => event,
      allInvoices: [...noise, target],
      captureUpdate: async (id: string, data: any) => { captured = { id, data }; return makeInvoice(data); },
    });

    const resp = await postWebhook(app, JSON.stringify(event));
    expect(resp.status).toBe(200);
    // The matching invoice (position 601) was found and marked paid.
    expect(captured?.id).toBe(INVOICE_ID);
    expect(captured?.data?.status).toBe('paid');
    expect(captured?.data?.paymentStatus).toBe('succeeded');
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

// ---------------------------------------------------------------------------
// Observability: structured log fields (Wave 4.5)
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — observability: structured log fields', () => {
  /**
   * Make a capturing logger that records all log calls.
   * Also implements .child() so the handler's child-logger pattern works:
   *   baseLogger.child({ traceId, module }) → childLogger (merged bindings)
   * This lets tests assert that the child logger is used and carries the right fields.
   */
  function makeCapturingLogger(calls: any[]) {
    function makeChild(inherited: Record<string, any>) {
      const child = {
        debug: (obj: any, msg?: string) => calls.push({ level: 'debug', ...inherited, ...obj, msg }),
        info:  (obj: any, msg?: string) => calls.push({ level: 'info',  ...inherited, ...obj, msg }),
        warn:  (obj: any, msg?: string) => calls.push({ level: 'warn',  ...inherited, ...obj, msg }),
        error: (obj: any, msg?: string) => calls.push({ level: 'error', ...inherited, ...obj, msg }),
        child: (bindings: Record<string, any>) => makeChild({ ...inherited, ...bindings }),
      };
      return child;
    }
    return makeChild({});
  }

  /**
   * Build a Hono app that injects a capturing logger and requestId, then
   * dispatches the handler directly (no middleware stack needed for unit test).
   */
  async function buildObsApp(deps: {
    verifySignature?: (rawBody: string, sig: string) => Promise<any>;
    invoiceById?: (id: string) => any;
    allInvoices?: any[];
    calls: any[];
  }) {
    const {
      verifySignature = async () => { throw new Error('no sig'); },
      invoiceById = () => makeInvoice(),
      allInvoices = [makeInvoice()],
      calls,
    } = deps;

    const { handleStripeWebhook } = await import('./handleStripeWebhook');
    const { InvoiceRepository } = await import('./repos/billing.repo');
    const { MerchantAccountRepository } = await import('./repos/billing.repo');

    const app = new Hono();
    attachErrorHandler(app);

    app.post('/', async (c) => {
      (c as any).set('logger', makeCapturingLogger(calls));
      (c as any).set('requestId', 'trace-abc-123');
      (c as any).set('billing', { verifyWebhookSignature: verifySignature });
      (c as any).set('notifs', { createNotification: async () => {} });

      const selectChain: any = {};
      const selectMethods = ['select', 'from', 'where', 'limit', 'offset', 'orderBy'];
      for (const m of selectMethods) selectChain[m] = () => selectChain;
      selectChain.then = (resolve: any, reject?: any) => Promise.resolve(allInvoices).then(resolve, reject);
      (c as any).set('database', { select: () => selectChain });

      const origFindOneById = InvoiceRepository.prototype.findOneById;
      const origUpdateOneById = InvoiceRepository.prototype.updateOneById;
      const origMAFindByStripe = MerchantAccountRepository.prototype.findByStripeAccountId;
      const origMAUpdateById = MerchantAccountRepository.prototype.updateOneById;

      InvoiceRepository.prototype.findOneById = async (id: string) => invoiceById(id);
      InvoiceRepository.prototype.updateOneById = async () => {};
      MerchantAccountRepository.prototype.findByStripeAccountId = async () => makeMerchantAccount();
      MerchantAccountRepository.prototype.updateOneById = async () => {};

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

  test('logs carry traceId from requestId on every call site', async () => {
    const calls: any[] = [];
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject());

    const app = await buildObsApp({
      verifySignature: async () => event,
      calls,
    });

    await postWebhook(app, JSON.stringify(event));

    expect(calls.length).toBeGreaterThan(0);
    // Every call site should have traceId (inherited from child logger bindings)
    for (const call of calls) {
      expect(call.traceId).toBe('trace-abc-123');
    }
  });

  test('logs carry module:billing on every call site', async () => {
    const calls: any[] = [];
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject());

    const app = await buildObsApp({
      verifySignature: async () => event,
      calls,
    });

    await postWebhook(app, JSON.stringify(event));

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.module).toBe('billing');
    }
  });

  test('dispatch log includes action field', async () => {
    const calls: any[] = [];
    const event = makeStripeEvent('invoice.created', { id: 'inv_xyz' });

    const app = await buildObsApp({
      verifySignature: async () => event,
      calls,
    });

    await postWebhook(app, JSON.stringify(event));

    const dispatchLog = calls.find(c => c.action === 'handleStripeWebhook.dispatch');
    expect(dispatchLog).toBeDefined();
    expect(dispatchLog.eventType).toBe('invoice.created');
    expect(dispatchLog.eventId).toBe('evt_test');
  });

  test('signature field is NOT present in any log call (PII guard)', async () => {
    const calls: any[] = [];
    // Cause verification to fail so we get the verify log
    const app = await buildObsApp({
      verifySignature: async () => { throw new Error('bad sig'); },
      calls,
    });

    // Post with a signature that would leak if logged
    const app2 = new Hono();
    attachErrorHandler(app2);
    // Just build fresh app with normal sig failure
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject());
    const app3 = await buildObsApp({ verifySignature: async () => event, calls });
    await postWebhook(app3, JSON.stringify(event));

    for (const call of calls) {
      expect('signature' in call).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// FIX-004: webhook idempotency for invoice payment events
// Stripe redelivers events; the same event.id must be a no-op for invoice
// payment handlers (mirrors the subscription path's lastStripeEventId dedupe).
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — idempotency (FIX-004)', () => {
  async function buildIdempotencyApp(deps: {
    verifySignature: () => Promise<any>;
    getInvoice: () => any;
    onUpdate: (id: string, data: any) => void;
    onNotify: () => void;
  }) {
    const { handleStripeWebhook } = await import('./handleStripeWebhook');
    const { InvoiceRepository } = await import('./repos/billing.repo');

    const app = new Hono();
    attachErrorHandler(app);

    app.post('/', async (c) => {
      (c as any).set('logger', makeNullLogger());
      (c as any).set('billing', { verifyWebhookSignature: deps.verifySignature });
      (c as any).set('notifs', { createNotification: async () => { deps.onNotify(); } });

      const selectChain: any = {};
      for (const m of ['select', 'from', 'where', 'limit', 'offset', 'orderBy']) selectChain[m] = () => selectChain;
      selectChain.then = (resolve: any, reject?: any) => Promise.resolve([]).then(resolve, reject);
      (c as any).set('database', { select: () => selectChain });

      const origFind = InvoiceRepository.prototype.findOneById;
      const origUpd = InvoiceRepository.prototype.updateOneById;
      const origFindPI = InvoiceRepository.prototype.findByStripePaymentIntentId;

      InvoiceRepository.prototype.findOneById = async () => deps.getInvoice();
      InvoiceRepository.prototype.updateOneById = async (id: string, data: any) => { deps.onUpdate(id, data); return data; };
      InvoiceRepository.prototype.findByStripePaymentIntentId = async () => deps.getInvoice();

      try {
        return await handleStripeWebhook(c as any);
      } finally {
        InvoiceRepository.prototype.findOneById = origFind;
        InvoiceRepository.prototype.updateOneById = origUpd;
        InvoiceRepository.prototype.findByStripePaymentIntentId = origFindPI;
      }
    });

    return app;
  }

  test('duplicate payment_intent.succeeded (same event.id) is a no-op: single transition + single notification', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject(), 'evt_idem_777');
    let stored = makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } });
    let updateCount = 0;
    let notifyCount = 0;

    const app = await buildIdempotencyApp({
      verifySignature: async () => event,
      getInvoice: () => stored,
      onUpdate: (_id, data) => { updateCount++; stored = { ...stored, ...data }; },
      onNotify: () => { notifyCount++; },
    });

    await postWebhook(app, JSON.stringify(event)); // first delivery — processes
    await postWebhook(app, JSON.stringify(event)); // redelivery (same id) — skipped

    expect(updateCount).toBe(1);
    expect(notifyCount).toBe(1);
  });

  test('duplicate charge.succeeded (same event.id) does not double-notify customer+merchant', async () => {
    const event = makeStripeEvent('charge.succeeded', makeChargeObject(), 'evt_idem_888');
    let stored = makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } });
    let updateCount = 0;
    let notifyCount = 0;

    const app = await buildIdempotencyApp({
      verifySignature: async () => event,
      getInvoice: () => stored,
      onUpdate: (_id, data) => { updateCount++; stored = { ...stored, ...data }; },
      onNotify: () => { notifyCount++; },
    });

    await postWebhook(app, JSON.stringify(event));
    await postWebhook(app, JSON.stringify(event));

    expect(updateCount).toBe(1);
    expect(notifyCount).toBe(2); // charge.succeeded notifies customer + merchant exactly once each
  });

  test('a distinct event.id for the same invoice still processes (not over-deduped)', async () => {
    let stored = makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } });
    let updateCount = 0;
    let notifyCount = 0;

    const buildFor = (evtId: string) => buildIdempotencyApp({
      verifySignature: async () => makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject(), evtId),
      getInvoice: () => stored,
      onUpdate: (_id, data) => { updateCount++; stored = { ...stored, ...data }; },
      onNotify: () => { notifyCount++; },
    });

    const e1 = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject(), 'evt_A');
    await postWebhook(await buildFor('evt_A'), JSON.stringify(e1));
    const e2 = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject(), 'evt_B');
    await postWebhook(await buildFor('evt_B'), JSON.stringify(e2));

    expect(updateCount).toBe(2); // two distinct events both processed
  });
});

// ---------------------------------------------------------------------------
// AHA notifications-webhook: organizationId must be threaded onto every
// createNotification call.
//
// NotificationRepository.createNotificationForModule (FIX-012) throws
// ValidationError when organizationId is missing/empty, and the webhook wraps
// each createNotification in a try/catch that only logs the error. So if the
// webhook omits organizationId, every payment notification SILENTLY DROPS:
// payment_authorized, payment_failed, payment_captured (customer),
// payment_received (merchant), charge_failed. The invoice already carries its
// notNull organizationId; the webhook must propagate it to each notification.
//
// CROSS-MODULE RISK (billing -> notifs): these tests assert the org actually
// reaches the notifs boundary, captured via a real-shaped createNotification.
// ---------------------------------------------------------------------------

describe('handleStripeWebhook — notification organizationId (billing -> notifs)', () => {
  /**
   * Build an app whose notifs.createNotification captures every request AND
   * enforces the same precondition the real NotificationRepository enforces
   * (FIX-012): reject a missing/empty organizationId. This guarantees the test
   * fails for the right reason (silent drop) before the fix, and proves real
   * propagation after.
   */
  async function buildNotifyApp(deps: {
    verifySignature: () => Promise<any>;
    invoiceById?: () => any;
    allInvoices?: any[];
    captured: any[];
  }) {
    const {
      verifySignature,
      invoiceById = () => makeInvoice(),
      allInvoices = [makeInvoice()],
      captured,
    } = deps;

    const { handleStripeWebhook } = await import('./handleStripeWebhook');
    const { InvoiceRepository } = await import('./repos/billing.repo');

    const app = new Hono();
    attachErrorHandler(app);

    app.post('/', async (c) => {
      (c as any).set('logger', makeNullLogger());
      (c as any).set('billing', { verifyWebhookSignature: verifySignature });
      // Mirror the real repo's organizationId precondition so an omitted org
      // throws here — exactly as it would in production (FIX-012). The webhook
      // swallows that throw, so the proof is "no captured request", not a 500.
      (c as any).set('notifs', {
        createNotification: async (req: any) => {
          if (!req?.organizationId || String(req.organizationId).trim() === '') {
            throw new Error('organizationId is required to create a notification');
          }
          captured.push(req);
          return { id: 'notif-1', ...req };
        },
      });

      const selectChain: any = {};
      for (const m of ['select', 'from', 'where', 'limit', 'offset', 'orderBy']) selectChain[m] = () => selectChain;
      selectChain.then = (resolve: any, reject?: any) => Promise.resolve(allInvoices).then(resolve, reject);
      (c as any).set('database', { select: () => selectChain });

      const origFind = InvoiceRepository.prototype.findOneById;
      const origUpd = InvoiceRepository.prototype.updateOneById;
      const origFindPI = InvoiceRepository.prototype.findByStripePaymentIntentId;

      InvoiceRepository.prototype.findOneById = async () => invoiceById();
      InvoiceRepository.prototype.updateOneById = async (_id: string, data: any) => ({ ...makeInvoice(), ...data });
      InvoiceRepository.prototype.findByStripePaymentIntentId = async (pi: string) =>
        allInvoices.find((inv: any) => (inv.metadata as any)?.stripePaymentIntentId === pi) ?? null;

      try {
        return await handleStripeWebhook(c as any);
      } finally {
        InvoiceRepository.prototype.findOneById = origFind;
        InvoiceRepository.prototype.updateOneById = origUpd;
        InvoiceRepository.prototype.findByStripePaymentIntentId = origFindPI;
      }
    });

    return app;
  }

  test('payment_intent.succeeded → payment_authorized notification carries the invoice organizationId', async () => {
    const event = makeStripeEvent('payment_intent.succeeded', makePaymentIntentObject(), 'evt_org_1');
    const captured: any[] = [];

    const app = await buildNotifyApp({ verifySignature: async () => event, captured });
    const resp = await postWebhook(app, JSON.stringify(event));

    expect(resp.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe('payment_authorized');
    expect(captured[0].recipient).toBe('cust-uuid');
    expect(captured[0].organizationId).toBe(ORG_ID);
  });

  test('payment_intent.payment_failed → payment_failed notification carries the invoice organizationId', async () => {
    const event = makeStripeEvent('payment_intent.payment_failed', makePaymentIntentObject({ status: 'canceled' }), 'evt_org_2');
    const captured: any[] = [];

    const app = await buildNotifyApp({ verifySignature: async () => event, captured });
    const resp = await postWebhook(app, JSON.stringify(event));

    expect(resp.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe('payment_failed');
    expect(captured[0].recipient).toBe('cust-uuid');
    expect(captured[0].organizationId).toBe(ORG_ID);
  });

  test('charge.succeeded → customer + merchant notifications both carry the invoice organizationId', async () => {
    const event = makeStripeEvent('charge.succeeded', makeChargeObject(), 'evt_org_3');
    const captured: any[] = [];

    const app = await buildNotifyApp({
      verifySignature: async () => event,
      allInvoices: [makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } })],
      captured,
    });
    const resp = await postWebhook(app, JSON.stringify(event));

    expect(resp.status).toBe(200);
    expect(captured).toHaveLength(2);

    const customerNote = captured.find((n) => n.type === 'payment_captured');
    const merchantNote = captured.find((n) => n.type === 'payment_received');

    expect(customerNote).toBeDefined();
    expect(customerNote.recipient).toBe('cust-uuid');
    expect(customerNote.organizationId).toBe(ORG_ID);

    expect(merchantNote).toBeDefined();
    expect(merchantNote.recipient).toBe('merch-uuid');
    expect(merchantNote.organizationId).toBe(ORG_ID);
  });

  test('charge.failed → charge_failed notification carries the invoice organizationId', async () => {
    const event = makeStripeEvent('charge.failed', makeChargeObject({ status: 'failed' }), 'evt_org_4');
    const captured: any[] = [];

    const app = await buildNotifyApp({
      verifySignature: async () => event,
      allInvoices: [makeInvoice({ metadata: { stripePaymentIntentId: PAYMENT_INTENT_ID } })],
      captured,
    });
    const resp = await postWebhook(app, JSON.stringify(event));

    expect(resp.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe('charge_failed');
    expect(captured[0].recipient).toBe('cust-uuid');
    expect(captured[0].organizationId).toBe(ORG_ID);
  });
});

// ---------------------------------------------------------------------------
// Subscription lifecycle — past_due transition (UJ-M03)
// ---------------------------------------------------------------------------

const STRIPE_SUB_ID = 'sub_test_platform_1';

function makeLocalSub(overrides?: Record<string, any>) {
  return {
    id: 'local-sub-1',
    organizationId: ORG_ID,
    stripeSubscriptionId: STRIPE_SUB_ID,
    status: 'active',
    lastStripeEventId: null,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2026-02-01'),
    ...overrides,
  };
}

function makeInvoiceObject(overrides?: Record<string, any>) {
  return {
    id: 'in_test_1',
    object: 'invoice',
    subscription: STRIPE_SUB_ID,
    period_start: Math.floor(new Date('2026-01-01').getTime() / 1000),
    lines: { data: [{ period: { end: Math.floor(new Date('2026-03-01').getTime() / 1000) } }] },
    ...overrides,
  };
}

describe('handleStripeWebhook — invoice.payment_failed (subscription past_due)', () => {
  test('moves the matched platform subscription to past_due', async () => {
    const event = makeStripeEvent('invoice.payment_failed', makeInvoiceObject(), 'evt_sub_fail_1');
    const sink: { set?: any } = {};

    const app = await buildApp({
      verifySignature: async () => event,
      subscriptionRow: makeLocalSub({ status: 'active' }),
      subscriptionUpdateSink: sink,
    });
    const resp = await postWebhook(app, JSON.stringify(event));

    expect(resp.status).toBe(200);
    expect(sink.set).toBeDefined();
    expect(sink.set.status).toBe('past_due');
    expect(sink.set.lastStripeEventId).toBe('evt_sub_fail_1');
  });

  test('is idempotent — skips update when lastStripeEventId already matches', async () => {
    const event = makeStripeEvent('invoice.payment_failed', makeInvoiceObject(), 'evt_dup');
    const sink: { set?: any } = {};

    const app = await buildApp({
      verifySignature: async () => event,
      subscriptionRow: makeLocalSub({ status: 'past_due', lastStripeEventId: 'evt_dup' }),
      subscriptionUpdateSink: sink,
    });
    const resp = await postWebhook(app, JSON.stringify(event));

    expect(resp.status).toBe(200);
    // Duplicate guard short-circuits before .set(), so the sink stays empty.
    expect(sink.set).toBeUndefined();
  });

  test('no-op (200) when the invoice has no matching platform subscription', async () => {
    const event = makeStripeEvent('invoice.payment_failed', makeInvoiceObject(), 'evt_no_match');
    const sink: { set?: any } = {};

    const app = await buildApp({
      verifySignature: async () => event,
      subscriptionRow: null, // db returns [] for the subscription lookup
      subscriptionUpdateSink: sink,
    });
    const resp = await postWebhook(app, JSON.stringify(event));

    expect(resp.status).toBe(200);
    expect(sink.set).toBeUndefined();
  });
});
