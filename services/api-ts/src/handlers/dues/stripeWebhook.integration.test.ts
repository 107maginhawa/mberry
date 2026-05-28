/**
 * Stripe Webhook Integration Tests
 *
 * Uses real Stripe SDK signature generation (generateTestHeaderStringAsync)
 * to test the full webhook verification + processing pipeline without mocks
 * on the crypto path. This validates that:
 * - Real Stripe signatures are accepted
 * - Tampered payloads are rejected
 * - The webhook event is correctly mapped and dispatched
 *
 * No stripe-mock Docker container needed — Stripe SDK handles signing locally.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import Stripe from 'stripe';
import { Hono } from 'hono';
import { stripeWebhookHandler } from './stripeWebhook';

// ─── Test Secrets ───────────────────────────────────────
// These are NOT real keys — test-only values for local signature generation.
const TEST_STRIPE_KEY = 'sk_test_fake_for_integration_test';
const TEST_WEBHOOK_SECRET = 'whsec_test_integration_secret_12345';

// ─── Stripe SDK instance for test header generation ─────
const stripe = new Stripe(TEST_STRIPE_KEY);

// ─── Mock downstream processor (we test the webhook layer, not settlement) ───
const mockHandleIncomingWebhook = mock(() =>
  Promise.resolve({ status: 200, action: 'processed' as const }),
);
mock.module('./jobs/webhookRetryProcessor', () => ({
  handleIncomingWebhook: mockHandleIncomingWebhook,
  computeNextRetryAt: () => null,
  processWebhookRetry: mock(),
  MAX_RETRIES: 4,
  BACKOFF_SCHEDULE_MS: [60000, 300000, 900000, 3600000],
}));

// ─── Real BillingService using test config ───────────────
import { BillingService } from '@/core/billing';

function createRealBillingService(): BillingService {
  const mockDb = {} as any;
  const mockLogger = {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
    child: () => mockLogger,
  } as any;

  return new BillingService(
    {
      provider: 'stripe',
      stripe: {
        secretKey: TEST_STRIPE_KEY,
        webhookSecret: TEST_WEBHOOK_SECRET,
        // No URL — we don't call Stripe API, only verify signatures locally
      },
    },
    mockDb,
    mockLogger,
  );
}

function createMockLogger() {
  const logger: any = {
    info: mock(),
    warn: mock(),
    error: mock(),
    debug: mock(),
    child: () => logger,
  };
  return logger;
}

function createTestApp(billing: BillingService) {
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

// ─── Helper: create a Stripe event payload ───────────────
function createStripeEventPayload(overrides: Partial<{
  id: string;
  type: string;
  amount: number;
  status: string;
  orgId: string;
  personId: string;
}> = {}) {
  return JSON.stringify({
    id: overrides.id ?? 'evt_integration_test_001',
    type: overrides.type ?? 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_integration_test_abc',
        status: overrides.status ?? 'succeeded',
        amount: overrides.amount ?? 5000,
        currency: 'php',
        metadata: {
          orgId: overrides.orgId ?? 'org-integration-1',
          personId: overrides.personId ?? 'person-integration-1',
          paymentId: 'pay-integration-1',
        },
      },
    },
  });
}

describe('Stripe Webhook Integration (real signatures)', () => {
  let billing: BillingService;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    mockHandleIncomingWebhook.mockClear();
    billing = createRealBillingService();
    app = createTestApp(billing);
  });

  test('accepts valid Stripe-signed webhook event', async () => {
    const payload = createStripeEventPayload();
    const header = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: TEST_WEBHOOK_SECRET,
    });

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': header,
        'content-type': 'application/json',
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.action).toBe('processed');

    // Verify downstream was called with correct event shape
    expect(mockHandleIncomingWebhook).toHaveBeenCalledTimes(1);
    const callArgs = mockHandleIncomingWebhook.mock.calls[0]![0] as any;
    expect(callArgs.event.idempotencyKey).toBe('evt_integration_test_001');
    expect(callArgs.event.provider).toBe('stripe');
    expect(callArgs.event.eventType).toBe('payment_intent.succeeded');
    expect(callArgs.event.organizationId).toBe('org-integration-1');
    expect(callArgs.event.payload.metadata.personId).toBe('person-integration-1');
  });

  test('rejects tampered payload (wrong body after signing)', async () => {
    const originalPayload = createStripeEventPayload();
    const header = await stripe.webhooks.generateTestHeaderStringAsync({
      payload: originalPayload,
      secret: TEST_WEBHOOK_SECRET,
    });

    // Tamper with payload after signing
    const tamperedPayload = createStripeEventPayload({ amount: 999999 });

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': header,
        'content-type': 'application/json',
      },
      body: tamperedPayload,
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid signature');
  });

  test('rejects wrong webhook secret', async () => {
    const payload = createStripeEventPayload();
    // Sign with a DIFFERENT secret than what billing service expects
    const header = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: 'whsec_WRONG_secret',
    });

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': header,
        'content-type': 'application/json',
      },
      body: payload,
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid signature');
  });

  test('rejects expired timestamp (replay attack)', async () => {
    const payload = createStripeEventPayload();
    // Generate header with old timestamp (5 minutes ago — Stripe default tolerance is 5 min)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
    const header = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: TEST_WEBHOOK_SECRET,
      timestamp: oldTimestamp,
    });

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': header,
        'content-type': 'application/json',
      },
      body: payload,
    });

    expect(res.status).toBe(400);
  });

  test('correctly maps charge.succeeded event type', async () => {
    const payload = createStripeEventPayload({
      id: 'evt_charge_001',
      type: 'charge.succeeded',
    });
    const header = await stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: TEST_WEBHOOK_SECRET,
    });

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': header,
        'content-type': 'application/json',
      },
      body: payload,
    });

    expect(res.status).toBe(200);
    const callArgs = mockHandleIncomingWebhook.mock.calls[0]![0] as any;
    expect(callArgs.event.eventType).toBe('charge.succeeded');
    expect(callArgs.event.idempotencyKey).toBe('evt_charge_001');
  });
});
