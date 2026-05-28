import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { stripeWebhookHandler } from './stripeWebhook';

// Mock the webhook retry processor
const mockHandleIncomingWebhook = mock(() =>
  Promise.resolve({ status: 200, action: 'processed' as const }),
);
mock.module('./jobs/webhookRetryProcessor', () => ({
  handleIncomingWebhook: mockHandleIncomingWebhook,
  // Re-export types needed
  computeNextRetryAt: () => null,
  processWebhookRetry: mock(),
  MAX_RETRIES: 4,
  BACKOFF_SCHEDULE_MS: [60000, 300000, 900000, 3600000],
}));

// Mock settle-payment to prevent actual DB calls
mock.module('./jobs/processStripePayment', () => ({
  createProcessPayment: () => mock(() => Promise.resolve({ success: true })),
}));

function createMockBilling(shouldVerify = true) {
  return {
    verifyWebhookSignature: shouldVerify
      ? mock(() =>
          Promise.resolve({
            id: 'evt_test_123',
            type: 'payment_intent.succeeded',
            data: {
              object: {
                id: 'pi_test_abc',
                status: 'succeeded',
                amount: 5000,
                metadata: { orgId: 'org-1', personId: 'person-1' },
              },
            },
          }),
        )
      : mock(() => Promise.reject(new Error('Invalid signature'))),
  } as any;
}

function createMockLogger() {
  return {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
    child: mock(() => createMockLogger()),
  } as any;
}

function createTestApp(billing: any) {
  const app = new Hono();
  const logger = createMockLogger();
  const db = {} as any;

  app.use('*', async (c, next) => {
    c.set('logger' as any, logger);
    c.set('billing' as any, billing);
    c.set('database' as any, db);
    await next();
  });

  app.post('/webhooks/stripe', stripeWebhookHandler as any);
  return app;
}

describe('stripeWebhookHandler', () => {
  beforeEach(() => {
    mockHandleIncomingWebhook.mockClear();
  });

  test('returns 400 when stripe-signature header is missing', async () => {
    const billing = createMockBilling();
    const app = createTestApp(billing);

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('stripe-signature');
  });

  test('returns 400 on invalid signature', async () => {
    const billing = createMockBilling(false);
    const app = createTestApp(billing);

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'invalid_sig' },
      body: '{}',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid signature');
  });

  test('processes valid webhook event', async () => {
    const billing = createMockBilling(true);
    const app = createTestApp(billing);

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': 't=123,v1=abc',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: 'evt_test' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(billing.verifyWebhookSignature).toHaveBeenCalled();
  });
});
