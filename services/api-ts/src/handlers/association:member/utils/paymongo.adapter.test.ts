/**
 * Tests for PayMongoAdapter
 *
 * Covers: createCheckout (success + HTTP error), verifyWebhook (valid/invalid signatures),
 * getPaymentStatus (success + HTTP error + status mapping).
 * Uses globalThis.fetch mock via spyOn.
 */
import { describe, test, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { createHmac } from 'crypto';
import { PayMongoAdapter } from './paymongo.adapter';
import { ExternalServiceError } from '@/core/errors';
import type { CheckoutOpts } from './gateway-adapter';

const SECRET_KEY = 'sk_test_abc';
const WEBHOOK_SECRET = 'whsec_test_xyz';

let adapter: PayMongoAdapter;

// Helper: build a valid signature header
function buildSig(body: string, secret: string, timestamp = '1718000000'): string {
  const payload = `${timestamp}.${body}`;
  const hex = createHmac('sha256', secret).update(payload).digest('hex');
  return `t=${timestamp},te=${hex}`;
}

// Helper: minimal checkout opts
function makeOpts(overrides: Partial<CheckoutOpts> = {}): CheckoutOpts {
  return {
    amount: 250000,
    currency: 'PHP',
    description: 'Annual dues',
    email: 'member@example.com',
    metadata: { duesInvoiceId: 'inv-1' },
    successUrl: 'https://app.com/success',
    cancelUrl: 'https://app.com/cancel',
    ...overrides,
  };
}

// Helper: mock a fetch response
function mockFetch(ok: boolean, body: unknown, status = ok ? 200 : 422) {
  const responseText = typeof body === 'string' ? body : JSON.stringify(body);
  return spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    text: async () => responseText,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  } as Response);
}

beforeEach(() => {
  adapter = new PayMongoAdapter(SECRET_KEY, WEBHOOK_SECRET);
});

afterEach(() => {
  mock.restore();
});

// ─── createCheckout ───────────────────────────────────────────────────────────

describe('PayMongoAdapter.createCheckout', () => {
  test('returns checkoutUrl and sessionId on success', async () => {
    mockFetch(true, {
      data: {
        id: 'cs_test_123',
        attributes: {
          checkout_url: 'https://paymongo.com/checkout/cs_test_123',
        },
      },
    });

    const result = await adapter.createCheckout(makeOpts());
    expect(result.checkoutUrl).toBe('https://paymongo.com/checkout/cs_test_123');
    expect(result.sessionId).toBe('cs_test_123');
  });

  test('sends Authorization header with base64-encoded secret key', async () => {
    let capturedInit: RequestInit | undefined;
    spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init?: RequestInit) => {
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        text: async () => '{}',
        json: async () => ({ data: { id: 'cs_1', attributes: { checkout_url: 'https://x.com' } } }),
      } as Response;
    });

    await adapter.createCheckout(makeOpts());
    const auth = (capturedInit?.headers as Record<string, string>)?.['Authorization'];
    expect(auth).toBe(`Basic ${btoa(SECRET_KEY + ':')}`);
  });

  test('sends amount as line_item in PHP centavos', async () => {
    let capturedBody: any;
    spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        text: async () => '{}',
        json: async () => ({ data: { id: 'cs_1', attributes: { checkout_url: 'https://x.com' } } }),
      } as Response;
    });

    await adapter.createCheckout(makeOpts({ amount: 999900 }));
    const lineItem = capturedBody?.data?.attributes?.line_items?.[0];
    expect(lineItem?.amount).toBe(999900);
    expect(lineItem?.currency).toBe('PHP');
  });

  test('throws ExternalServiceError on non-ok response', async () => {
    mockFetch(false, 'Unprocessable entity', 422);
    await expect(adapter.createCheckout(makeOpts())).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('ExternalServiceError includes PayMongo error body text', async () => {
    mockFetch(false, 'Invalid amount', 400);
    try {
      await adapter.createCheckout(makeOpts({ amount: -1 }));
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toMatch(/PayMongo checkout failed/i);
      expect(e.message).toContain('Invalid amount');
    }
  });
});

// ─── verifyWebhook ────────────────────────────────────────────────────────────

describe('PayMongoAdapter.verifyWebhook', () => {
  function buildBody(invoiceId: string, status = 'paid', amount = 250000): string {
    return JSON.stringify({
      data: {
        id: 'evt_abc',
        attributes: {
          type: 'payment.paid',
          data: {
            attributes: {
              status,
              amount,
              currency: 'PHP',
              metadata: { duesInvoiceId: invoiceId },
            },
          },
          metadata: { duesInvoiceId: invoiceId },
        },
      },
    });
  }

  test('returns WebhookEvent for valid signature (test sig, te= prefix)', () => {
    const body = buildBody('inv-1');
    const sig = buildSig(body, WEBHOOK_SECRET);
    const event = adapter.verifyWebhook(body, sig);
    expect(event).not.toBeNull();
    expect(event?.metadata?.['duesInvoiceId']).toBe('inv-1');
  });

  test('returns WebhookEvent for valid signature (live sig, li= prefix)', () => {
    const body = buildBody('inv-live');
    const timestamp = '1718001111';
    const payload = `${timestamp}.${body}`;
    const hex = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
    const sig = `t=${timestamp},li=${hex}`;
    const event = adapter.verifyWebhook(body, sig);
    expect(event).not.toBeNull();
    expect(event?.metadata?.['duesInvoiceId']).toBe('inv-live');
  });

  test('prefers live sig (li=) over test sig (te=) when both present', () => {
    const body = buildBody('inv-both');
    const timestamp = '1718002222';
    const payload = `${timestamp}.${body}`;
    const liveHex = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
    const wrongTestHex = createHmac('sha256', 'wrong').update(payload).digest('hex');
    const sig = `t=${timestamp},te=${wrongTestHex},li=${liveHex}`;
    // live sig is valid → should return event
    const event = adapter.verifyWebhook(body, sig);
    expect(event).not.toBeNull();
  });

  test('returns null for empty signature string', () => {
    const body = buildBody('inv-1');
    expect(adapter.verifyWebhook(body, '')).toBeNull();
  });

  test('returns null when t= missing', () => {
    const body = buildBody('inv-1');
    const hex = createHmac('sha256', WEBHOOK_SECRET).update('x.' + body).digest('hex');
    expect(adapter.verifyWebhook(body, `te=${hex}`)).toBeNull();
  });

  test('returns null when sig is not 64-char hex', () => {
    const body = buildBody('inv-1');
    expect(adapter.verifyWebhook(body, 't=1234,te=abc123')).toBeNull();
  });

  test('returns null for wrong secret (tampered HMAC)', () => {
    const body = buildBody('inv-1');
    const wrongSig = buildSig(body, 'wrong-secret');
    expect(adapter.verifyWebhook(body, wrongSig)).toBeNull();
  });

  test('returns null when body is tampered after signing', () => {
    const body = buildBody('inv-1');
    const sig = buildSig(body, WEBHOOK_SECRET);
    const tampered = body + ' extra';
    expect(adapter.verifyWebhook(tampered, sig)).toBeNull();
  });

  test('maps amount correctly from data.attributes.amount (centavos)', () => {
    const body = buildBody('inv-centavos', 'paid', 999900);
    const sig = buildSig(body, WEBHOOK_SECRET);
    const event = adapter.verifyWebhook(body, sig);
    expect(event?.amount).toBe(999900);
  });

  test('returns null for malformed JSON body', () => {
    const sig = buildSig('{invalid', WEBHOOK_SECRET);
    expect(adapter.verifyWebhook('{invalid', sig)).toBeNull();
  });

  test('returns null for JSON missing data.attributes', () => {
    const body = JSON.stringify({ data: { id: 'x' } }); // no attributes
    const sig = buildSig(body, WEBHOOK_SECRET);
    expect(adapter.verifyWebhook(body, sig)).toBeNull();
  });

  test('gatewayEventId comes from data.id field', () => {
    const body = JSON.stringify({
      data: {
        id: 'evt_gateway_001',
        attributes: {
          type: 'payment.paid',
          data: {
            attributes: {
              status: 'paid',
              amount: 250000,
              currency: 'PHP',
              metadata: { duesInvoiceId: 'inv-gw' },
            },
          },
          metadata: { duesInvoiceId: 'inv-gw' },
        },
      },
    });
    const sig = buildSig(body, WEBHOOK_SECRET);
    const event = adapter.verifyWebhook(body, sig);
    expect(event?.gatewayEventId).toBe('evt_gateway_001');
  });
});

// ─── getPaymentStatus ─────────────────────────────────────────────────────────

describe('PayMongoAdapter.getPaymentStatus', () => {
  function makeStatusResponse(
    piStatus: string,
    paymentId = 'pay_001',
    paidAt = 1718000000,
    amount = 250000,
    currency = 'PHP',
  ) {
    return {
      data: {
        attributes: {
          payment_intent: { attributes: { status: piStatus } },
          payments: [{ id: paymentId, attributes: { paid_at: paidAt } }],
          line_items: [{ amount, currency }],
        },
      },
    };
  }

  test('returns status=paid for payment_intent status "paid"', async () => {
    mockFetch(true, makeStatusResponse('paid'));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.status).toBe('paid');
    expect(result.amount).toBe(250000);
    expect(result.currency).toBe('PHP');
  });

  test('returns status=paid for payment_intent status "succeeded"', async () => {
    mockFetch(true, makeStatusResponse('succeeded'));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.status).toBe('paid');
  });

  test('returns status=pending for "awaiting_payment_method"', async () => {
    mockFetch(true, makeStatusResponse('awaiting_payment_method'));
    const result = await adapter.getPaymentStatus('cs_pending');
    expect(result.status).toBe('pending');
  });

  test('returns status=pending for "processing"', async () => {
    mockFetch(true, makeStatusResponse('processing'));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.status).toBe('pending');
  });

  test('returns status=expired for "expired"', async () => {
    mockFetch(true, makeStatusResponse('expired'));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.status).toBe('expired');
  });

  test('returns status=failed for "failed"', async () => {
    mockFetch(true, makeStatusResponse('failed'));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.status).toBe('failed');
  });

  test('returns status=pending for unknown status string (default)', async () => {
    mockFetch(true, makeStatusResponse('some_unknown_state'));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.status).toBe('pending');
  });

  test('gatewayEventId is payment id when payments array present', async () => {
    mockFetch(true, makeStatusResponse('paid', 'pay_xyz'));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.gatewayEventId).toBe('pay_xyz');
  });

  test('gatewayEventId falls back to sessionId when no payments', async () => {
    mockFetch(true, {
      data: {
        attributes: {
          payment_intent: { attributes: { status: 'awaiting_payment_method' } },
          payments: [],
          line_items: [{ amount: 100000, currency: 'PHP' }],
        },
      },
    });
    const result = await adapter.getPaymentStatus('cs_fallback');
    expect(result.gatewayEventId).toBe('cs_fallback');
  });

  test('paidAt is converted from unix timestamp seconds to Date', async () => {
    const unixSec = 1718000000;
    mockFetch(true, makeStatusResponse('paid', 'pay_001', unixSec));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.paidAt).toBeInstanceOf(Date);
    expect(result.paidAt?.getTime()).toBe(unixSec * 1000);
  });

  test('paidAt is undefined when no payments', async () => {
    mockFetch(true, {
      data: {
        attributes: {
          payment_intent: { attributes: { status: 'paid' } },
          payments: [],
          line_items: [{ amount: 250000, currency: 'PHP' }],
        },
      },
    });
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.paidAt).toBeUndefined();
  });

  test('amount comes from line_items[0].amount', async () => {
    mockFetch(true, makeStatusResponse('paid', 'pay_001', 1718000000, 750000, 'PHP'));
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.amount).toBe(750000);
  });

  test('amount defaults to 0 when line_items empty', async () => {
    mockFetch(true, {
      data: {
        attributes: {
          payment_intent: { attributes: { status: 'paid' } },
          payments: [{ id: 'pay_1', attributes: { paid_at: 1718000000 } }],
          line_items: [],
        },
      },
    });
    const result = await adapter.getPaymentStatus('cs_abc');
    expect(result.amount).toBe(0);
  });

  test('throws ExternalServiceError on non-ok HTTP response', async () => {
    mockFetch(false, 'Not found', 404);
    await expect(adapter.getPaymentStatus('cs_404')).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('ExternalServiceError message includes HTTP status code', async () => {
    mockFetch(false, 'Server error', 500);
    try {
      await adapter.getPaymentStatus('cs_500');
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.message).toContain('500');
    }
  });
});

// ─── verifyCredentials ────────────────────────────────────────────────────────

describe('PayMongoAdapter.verifyCredentials', () => {
  test('returns true for 2xx response (valid key)', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"data":[]}',
      json: async () => ({ data: [] }),
    } as Response);

    const result = await PayMongoAdapter.verifyCredentials('sk_test_valid');
    expect(result).toBe(true);
  });

  test('calls GET /v1/payments?limit=1', async () => {
    let capturedUrl: string | undefined;
    spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      capturedUrl = typeof url === 'string' ? url : String(url);
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) } as Response;
    });

    await PayMongoAdapter.verifyCredentials('sk_test_valid');
    expect(capturedUrl).toBe('https://api.paymongo.com/v1/payments?limit=1');
  });

  test('sends Basic auth header with secretKey + colon', async () => {
    let capturedInit: RequestInit | undefined;
    spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) } as Response;
    });

    await PayMongoAdapter.verifyCredentials('sk_test_mykey');
    const auth = (capturedInit?.headers as Record<string, string>)?.['Authorization'];
    expect(auth).toBe(`Basic ${btoa('sk_test_mykey:')}`);
  });

  test('returns false for 401 (bad key)', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
      json: async () => ({}),
    } as Response);

    const result = await PayMongoAdapter.verifyCredentials('sk_bad_key');
    expect(result).toBe(false);
  });

  test('returns false for 403 (forbidden key)', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
      json: async () => ({}),
    } as Response);

    const result = await PayMongoAdapter.verifyCredentials('sk_forbidden_key');
    expect(result).toBe(false);
  });

  test('throws ExternalServiceError for unexpected status (e.g. 500)', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
      json: async () => ({}),
    } as Response);

    await expect(PayMongoAdapter.verifyCredentials('sk_test_key')).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('ExternalServiceError message contains the unexpected status code', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
      json: async () => ({}),
    } as Response);

    try {
      await PayMongoAdapter.verifyCredentials('sk_test_key');
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.message).toContain('503');
    }
  });

  test('does NOT log the secret key (no key in error message)', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Error',
      json: async () => ({}),
    } as Response);

    const secretKey = 'sk_live_supersecret_12345';
    try {
      await PayMongoAdapter.verifyCredentials(secretKey);
    } catch (e: any) {
      expect(e.message).not.toContain(secretKey);
    }
  });
});

// ─── createCheckout idempotency ───────────────────────────────────────────────

describe('PayMongoAdapter.createCheckout idempotency', () => {
  test('sends the Idempotency-Key header when provided', async () => {
    let seen: Record<string, string> = {};
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: any) => {
      seen = init.headers;
      return new Response(JSON.stringify({ data: { id: 'cs_1', attributes: { checkout_url: 'https://x' } } }), { status: 200 });
    }) as any;
    try {
      const a = new PayMongoAdapter('sk_test', 'whsec');
      await a.createCheckout({ amount: 1000, currency: 'PHP', description: 'd', email: 'm@x.com', metadata: {}, successUrl: 's', cancelUrl: 'c' }, 'idem-123');
      expect(seen['Idempotency-Key']).toBe('idem-123');
    } finally { globalThis.fetch = orig; }
  });

  test('does NOT send Idempotency-Key header when arg is omitted', async () => {
    let seen: Record<string, string> = {};
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: any) => {
      seen = init.headers;
      return new Response(JSON.stringify({ data: { id: 'cs_2', attributes: { checkout_url: 'https://x' } } }), { status: 200 });
    }) as any;
    try {
      const a = new PayMongoAdapter('sk_test', 'whsec');
      await a.createCheckout({ amount: 1000, currency: 'PHP', description: 'd', email: 'm@x.com', metadata: {}, successUrl: 's', cancelUrl: 'c' });
      expect(seen['Idempotency-Key']).toBeUndefined();
    } finally { globalThis.fetch = orig; }
  });
});
