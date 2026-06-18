/**
 * Tests for handlePaymentWebhook
 *
 * Webhook handler: no auth, signature-verified.
 * Uses real HMAC to produce valid/invalid signatures (no mocking of crypto).
 */
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test';
import { createHmac } from 'crypto';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesInvoice } from '@/test-utils/factories';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { handlePaymentWebhook } from './handlePaymentWebhook';

// ─── Env fixture ─────────────────────────────────────────────────────────────

const TEST_SECRET_KEY = 'sk_test_abc123';
const TEST_WEBHOOK_SECRET = 'whsec_test_xyz789';

let origSecretKey: string | undefined;
let origWebhookSecret: string | undefined;

beforeAll(() => {
  origSecretKey = process.env['PAYMONGO_SECRET_KEY'];
  origWebhookSecret = process.env['PAYMONGO_WEBHOOK_SECRET'];
  process.env['PAYMONGO_SECRET_KEY'] = TEST_SECRET_KEY;
  process.env['PAYMONGO_WEBHOOK_SECRET'] = TEST_WEBHOOK_SECRET;
});

afterAll(() => {
  if (origSecretKey === undefined) {
    delete process.env['PAYMONGO_SECRET_KEY'];
  } else {
    process.env['PAYMONGO_SECRET_KEY'] = origSecretKey;
  }
  if (origWebhookSecret === undefined) {
    delete process.env['PAYMONGO_WEBHOOK_SECRET'];
  } else {
    process.env['PAYMONGO_WEBHOOK_SECRET'] = origWebhookSecret;
  }
});

afterEach(() => {
  restoreRepo(DuesInvoiceRepository);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a valid PayMongo-style signature header for the given body + secret. */
function buildSignature(body: string, secret: string, timestamp = '1718000000'): string {
  const payload = `${timestamp}.${body}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `t=${timestamp},te=${sig}`;
}

/** Minimal valid PayMongo webhook event body referencing a specific invoiceId. */
function buildEventBody(invoiceId: string | null, status = 'payment.paid', amount = 250000): string {
  return JSON.stringify({
    data: {
      id: 'evt_123',
      attributes: {
        type: status,
        data: {
          attributes: {
            status: 'paid',
            amount,
            currency: 'PHP',
            metadata: invoiceId ? { duesInvoiceId: invoiceId } : {},
          },
        },
        metadata: invoiceId ? { duesInvoiceId: invoiceId } : {},
      },
    },
  });
}

/** Make a ctx that supplies req.text() and req.header() for webhook use. */
function makeWebhookCtx(body: string, signatureHeader: string, extraVars: Record<string, any> = {}) {
  const ctx = makeCtx({
    user: null,
    ...extraVars,
  }) as any;

  // Override req methods not present in makeCtx
  ctx.req.text = () => Promise.resolve(body);
  ctx.req.header = (name: string) => {
    if (name === 'paymongo-signature') return signatureHeader;
    return null;
  };

  return ctx;
}

const fakeLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => fakeLogger,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('handlePaymentWebhook — config gate', () => {
  test('returns 503 when PAYMONGO_SECRET_KEY is missing', async () => {
    const saved = process.env['PAYMONGO_SECRET_KEY'];
    delete process.env['PAYMONGO_SECRET_KEY'];
    const body = buildEventBody('inv-1');
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const ctx = makeWebhookCtx(body, sig, { logger: fakeLogger });
    const res = await handlePaymentWebhook(ctx);
    expect(res.status).toBe(503);
    expect((res as any).body?.error).toMatch(/not configured/i);
    process.env['PAYMONGO_SECRET_KEY'] = saved;
  });

  test('returns 503 when PAYMONGO_WEBHOOK_SECRET is missing', async () => {
    const saved = process.env['PAYMONGO_WEBHOOK_SECRET'];
    delete process.env['PAYMONGO_WEBHOOK_SECRET'];
    const body = buildEventBody('inv-1');
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const ctx = makeWebhookCtx(body, sig, { logger: fakeLogger });
    const res = await handlePaymentWebhook(ctx);
    expect(res.status).toBe(503);
    expect((res as any).body?.error).toMatch(/not configured/i);
    process.env['PAYMONGO_WEBHOOK_SECRET'] = saved;
  });
});

describe('handlePaymentWebhook — signature verification', () => {
  test('returns 400 when signature header is empty', async () => {
    const body = buildEventBody('inv-1');
    const ctx = makeWebhookCtx(body, '', { logger: fakeLogger });
    const res = await handlePaymentWebhook(ctx);
    expect(res.status).toBe(400);
    expect((res as any).body?.error).toMatch(/signature/i);
  });

  test('returns 400 when signature is tampered (wrong HMAC)', async () => {
    const body = buildEventBody('inv-1');
    const wrongSig = buildSignature(body, 'wrong-secret');
    const ctx = makeWebhookCtx(body, wrongSig, { logger: fakeLogger });
    const res = await handlePaymentWebhook(ctx);
    expect(res.status).toBe(400);
    expect((res as any).body?.error).toMatch(/signature/i);
  });

  test('returns 400 when signature hex is not 64 chars', async () => {
    const body = buildEventBody('inv-1');
    const ctx = makeWebhookCtx(body, 't=1234,te=tooshort', { logger: fakeLogger });
    const res = await handlePaymentWebhook(ctx);
    expect(res.status).toBe(400);
  });

  test('returns 400 when body is tampered after signing', async () => {
    const body = buildEventBody('inv-1');
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const tamperedBody = body + ' ';
    const ctx = makeWebhookCtx(tamperedBody, sig, { logger: fakeLogger });
    const res = await handlePaymentWebhook(ctx);
    expect(res.status).toBe(400);
  });
});

describe('handlePaymentWebhook — valid signature, event routing', () => {
  test('ignores event when metadata has no duesInvoiceId', async () => {
    const body = buildEventBody(null); // no invoiceId
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const ctx = makeWebhookCtx(body, sig, { logger: fakeLogger });

    const res = await handlePaymentWebhook(ctx);
    expect(res.status).toBeUndefined(); // ctx.json returns { body, status } with status as 2nd arg (200 default)
    expect((res as any).body?.received).toBe(true);
    expect((res as any).body?.action).toBe('ignored');
  });

  test('acknowledges unknown invoice without error', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => null,
    });
    const body = buildEventBody('nonexistent-inv');
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const ctx = makeWebhookCtx(body, sig, { logger: fakeLogger });

    const res = await handlePaymentWebhook(ctx);
    expect((res as any).body?.received).toBe(true);
    expect((res as any).body?.action).toBe('unknown_invoice');
  });

  test('returns already_paid when invoice already has status=paid (idempotency)', async () => {
    const invoice = fakeDuesInvoice({ id: 'inv-paid', status: 'paid', version: 3 });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => invoice,
    });
    const body = buildEventBody('inv-paid');
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const ctx = makeWebhookCtx(body, sig, { logger: fakeLogger });

    const res = await handlePaymentWebhook(ctx);
    expect((res as any).body?.received).toBe(true);
    expect((res as any).body?.action).toBe('already_paid');
  });

  test('marks invoice paid and returns action=processed for paid event', async () => {
    const invoice = fakeDuesInvoice({ id: 'inv-1', status: 'generated', version: 1, amount: 250000 });
    let markPaidCalled = false;
    let capturedGatewayId: string | undefined;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async (id: string) => (id === 'inv-1' ? invoice : null),
      markPaid: async (invoiceId: string, version: number, gatewayEventId: string) => {
        markPaidCalled = true;
        capturedGatewayId = gatewayEventId;
        expect(invoiceId).toBe('inv-1');
        expect(version).toBe(1);
      },
    });

    const body = buildEventBody('inv-1', 'payment.paid', 250000);
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const ctx = makeWebhookCtx(body, sig, { logger: fakeLogger });

    const res = await handlePaymentWebhook(ctx);
    expect((res as any).body?.received).toBe(true);
    expect((res as any).body?.action).toBe('processed');
    expect(markPaidCalled).toBe(true);
    expect(capturedGatewayId).toBeDefined();
  });

  test('sets audit context fields after marking paid', async () => {
    const invoice = fakeDuesInvoice({ id: 'inv-audit', status: 'generated', version: 2, amount: 100000 });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => invoice,
      markPaid: async () => {},
    });

    const body = buildEventBody('inv-audit', 'payment.paid', 100000);
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const vars: Record<string, any> = {};
    const ctx = makeWebhookCtx(body, sig, { logger: fakeLogger });
    // Capture ctx.set calls
    const originalSet = ctx.set.bind(ctx);
    const setCalls: Record<string, any> = {};
    ctx.set = (key: string, val: any) => {
      setCalls[key] = val;
      return originalSet(key, val);
    };

    await handlePaymentWebhook(ctx);

    expect(setCalls['auditResourceId']).toBe('inv-audit');
    expect(setCalls['auditDescription']).toMatch(/paymongo/i);
    expect(setCalls['auditDetails']).toMatchObject({ amount: expect.any(Number) });
  });

  test('non-paid event status returns action=noted without calling markPaid', async () => {
    const invoice = fakeDuesInvoice({ id: 'inv-pending', status: 'generated', version: 1 });
    let markPaidCalled = false;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => invoice,
      markPaid: async () => { markPaidCalled = true; },
    });

    // Build a body where the adapter will parse status as something other than 'paid'
    // The webhook body event type is non-paid; verifyWebhook maps event.data.attributes.data.attributes.status
    const pendingBody = JSON.stringify({
      data: {
        id: 'evt_456',
        attributes: {
          type: 'payment.pending',
          data: {
            attributes: {
              status: 'pending',
              amount: 250000,
              currency: 'PHP',
              metadata: { duesInvoiceId: 'inv-pending' },
            },
          },
          metadata: { duesInvoiceId: 'inv-pending' },
        },
      },
    });
    const sig = buildSignature(pendingBody, TEST_WEBHOOK_SECRET);
    const ctx = makeWebhookCtx(pendingBody, sig, { logger: fakeLogger });

    const res = await handlePaymentWebhook(ctx);
    expect((res as any).body?.action).toBe('noted');
    expect(markPaidCalled).toBe(false);
  });

  test('amount in auditDetails matches event amount (centavo precision)', async () => {
    const invoice = fakeDuesInvoice({ id: 'inv-amt', status: 'generated', version: 1 });
    const CENTAVOS = 999900; // PHP 9,999.00
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => invoice,
      markPaid: async () => {},
    });

    const body = buildEventBody('inv-amt', 'payment.paid', CENTAVOS);
    const sig = buildSignature(body, TEST_WEBHOOK_SECRET);
    const ctx = makeWebhookCtx(body, sig, { logger: fakeLogger });
    const setCalls: Record<string, any> = {};
    ctx.set = (key: string, val: any) => { setCalls[key] = val; };

    await handlePaymentWebhook(ctx);
    expect(setCalls['auditDetails']?.amount).toBe(CENTAVOS);
  });
});
