/**
 * Branch-coverage tests for core/billing.ts BillingService.
 *
 * billing.ts is a thin wrapper over the Stripe SDK. The existing
 * billing.test.ts only guards secret-key redaction on init. This suite drives
 * EVERY public method's happy path AND error path without any network by
 * injecting a fake Stripe client into the service (the methods call the private
 * `ensureStripeInitialized()`, which returns `this.stripe` when already set —
 * so assigning `(service as any).stripe` bypasses real SDK construction).
 *
 * It also covers `ensureStripeInitialized` directly: the not-configured throw,
 * the missing-secret-key throw, the custom-URL parsing branch (http + https),
 * and the createBillingService factory.
 *
 * No real Postgres or Stripe is required — pure unit coverage.
 */

import { describe, test, expect, mock } from 'bun:test';
import type { Logger } from 'pino';
import { BillingService, createBillingService } from './billing';
import type { BillingConfig } from './billing-types';

function makeLogger(): Logger {
  const noop = () => {};
  const logger = {
    info: noop,
    debug: noop,
    warn: noop,
    error: noop,
    trace: noop,
    fatal: noop,
    child: () => logger,
  } as unknown as Logger;
  return logger;
}

function makeConfig(overrides: Partial<BillingConfig['stripe']> = {}): BillingConfig {
  return {
    provider: 'stripe',
    stripe: {
      secretKey: 'sk_test_x',
      webhookSecret: 'whsec_test',
      ...overrides,
    },
  } as BillingConfig;
}

/** A fake Stripe whose nested namespaces return canned objects. */
function makeFakeStripe(over: any = {}) {
  return {
    accounts: {
      create: mock(async () => ({ id: 'acct_123' })),
      retrieve: mock(async () => ({
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [], disabled_reason: null },
      })),
      createLoginLink: mock(async () => ({ url: 'https://dash.stripe/login' })),
    },
    accountLinks: {
      create: mock(async () => ({ url: 'https://connect.stripe/onboard' })),
    },
    checkout: {
      sessions: {
        create: mock(async () => ({
          id: 'cs_1',
          payment_intent: 'pi_checkout',
          url: 'https://checkout.stripe/pay',
        })),
      },
    },
    paymentIntents: {
      create: mock(async () => ({ id: 'pi_1', client_secret: 'pi_1_secret', status: 'requires_capture' })),
      capture: mock(async () => ({ id: 'pi_1', status: 'succeeded', latest_charge: 'ch_1' })),
      cancel: mock(async () => ({ id: 'pi_1', status: 'canceled' })),
      retrieve: mock(async () => ({
        id: 'pi_1',
        status: 'succeeded',
        amount: 5000,
        currency: 'php',
        latest_charge: 'ch_1',
      })),
    },
    charges: {
      retrieve: mock(async () => ({ id: 'ch_1', status: 'succeeded', amount: 5000, transfer: 'tr_1' })),
    },
    refunds: {
      create: mock(async () => ({ id: 're_1', status: 'succeeded', amount: 5000 })),
    },
    webhooks: {
      constructEventAsync: mock(async () => ({ id: 'evt_1', type: 'payment_intent.succeeded' })),
    },
    ...over,
  };
}

/** Build a service with a fake Stripe already injected (skips real SDK init). */
function makeService(fake = makeFakeStripe(), config = makeConfig()) {
  const svc = new BillingService(config, {} as any, makeLogger());
  (svc as any).stripe = fake;
  return svc;
}

describe('BillingService.ensureStripeInitialized', () => {
  test('throws when Stripe is not configured at all', () => {
    const svc = new BillingService({ provider: 'stripe' } as BillingConfig, {} as any, makeLogger());
    expect(() => (svc as any).ensureStripeInitialized()).toThrow(/not configured/i);
  });

  test('throws when secret key is missing', () => {
    const svc = new BillingService(
      { provider: 'stripe', stripe: { secretKey: '' } } as BillingConfig,
      {} as any,
      makeLogger(),
    );
    expect(() => (svc as any).ensureStripeInitialized()).toThrow(/secret key is required/i);
  });

  test('returns the cached instance when already initialized', () => {
    const fake = makeFakeStripe();
    const svc = makeService(fake);
    expect((svc as any).ensureStripeInitialized()).toBe(fake);
  });

  test('parses a custom https URL (real SDK construct, no network)', () => {
    const svc = new BillingService(
      makeConfig({ url: 'https://localhost:12111' }),
      {} as any,
      makeLogger(),
    );
    const stripe = (svc as any).ensureStripeInitialized();
    expect(stripe).toBeDefined();
  });

  test('parses a custom http URL (default port branch)', () => {
    const svc = new BillingService(
      makeConfig({ url: 'http://localhost' }),
      {} as any,
      makeLogger(),
    );
    const stripe = (svc as any).ensureStripeInitialized();
    expect(stripe).toBeDefined();
  });
});

describe('BillingService.createConnectAccount', () => {
  test('creates account + onboarding link (with email)', async () => {
    const svc = makeService();
    const res = await svc.createConnectAccount({
      email: 'p@x.com',
      country: 'PH',
      businessType: 'individual',
      refreshUrl: 'https://r',
      returnUrl: 'https://ret',
      metadata: { a: '1' },
    });
    expect(res.accountId).toBe('acct_123');
    expect(res.onboardingUrl).toContain('onboard');
  });

  test('wraps errors', async () => {
    const fake = makeFakeStripe();
    fake.accounts.create = mock(async () => { throw new Error('boom'); });
    const svc = makeService(fake);
    await expect(
      svc.createConnectAccount({ businessType: 'company', refreshUrl: 'r', returnUrl: 'ret' }),
    ).rejects.toThrow(/Failed to create Stripe Connect account/);
  });
});

describe('BillingService.generateOnboardingLink', () => {
  test('happy path', async () => {
    const svc = makeService();
    const res = await svc.generateOnboardingLink('acct_1', 'r', 'ret');
    expect(res.onboardingUrl).toContain('onboard');
  });
  test('error path', async () => {
    const fake = makeFakeStripe();
    fake.accountLinks.create = mock(async () => { throw new Error('x'); });
    await expect(makeService(fake).generateOnboardingLink('a', 'r', 'ret')).rejects.toThrow(/Failed to generate onboarding link/);
  });
});

describe('BillingService.getConnectAccountStatus', () => {
  test('active account returns dashboard url', async () => {
    const res = await makeService().getConnectAccountStatus('acct_1');
    expect(res.status).toBe('active');
    expect(res.onboardingComplete).toBe(true);
    expect(res.dashboardUrl).toContain('login');
  });

  test('restricted account (disabled_reason set, no charges)', async () => {
    const fake = makeFakeStripe();
    fake.accounts.retrieve = mock(async () => ({
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: ['x'], disabled_reason: 'rejected.fraud' },
    }));
    const res = await makeService(fake).getConnectAccountStatus('acct_1');
    expect(res.status).toBe('restricted');
    expect(res.onboardingComplete).toBe(false);
    expect(res.dashboardUrl).toBeUndefined();
  });

  test('pending account (no charges, no disabled reason)', async () => {
    const fake = makeFakeStripe();
    fake.accounts.retrieve = mock(async () => ({
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: [], disabled_reason: null },
    }));
    const res = await makeService(fake).getConnectAccountStatus('acct_1');
    expect(res.status).toBe('pending');
  });

  test('error path', async () => {
    const fake = makeFakeStripe();
    fake.accounts.retrieve = mock(async () => { throw new Error('x'); });
    await expect(makeService(fake).getConnectAccountStatus('a')).rejects.toThrow(/Failed to get Connect account status/);
  });
});

describe('BillingService.createPaymentIntent', () => {
  const base = {
    amount: 5000,
    currency: 'php',
    connectedAccountId: 'acct_1',
    platformFeeAmount: 500,
    description: 'svc',
  };

  test('creates a Checkout Session when success+cancel URLs present', async () => {
    const res = await makeService().createPaymentIntent({
      ...base,
      successUrl: 'https://ok',
      cancelUrl: 'https://no',
      metadata: { x: '1' },
    });
    expect(res.paymentIntentId).toBe('pi_checkout');
    expect(res.checkoutUrl).toContain('checkout');
    expect(res.status).toBe('pending');
  });

  test('creates a raw PaymentIntent when no URLs', async () => {
    const res = await makeService().createPaymentIntent(base);
    expect(res.paymentIntentId).toBe('pi_1');
    expect(res.clientSecret).toBe('pi_1_secret');
  });

  test('error path', async () => {
    const fake = makeFakeStripe();
    fake.paymentIntents.create = mock(async () => { throw new Error('x'); });
    await expect(makeService(fake).createPaymentIntent(base)).rejects.toThrow(/Failed to create payment intent/);
  });
});

describe('BillingService.capturePaymentIntent', () => {
  test('captures + resolves transfer id when succeeded', async () => {
    const res = await makeService().capturePaymentIntent('pi_1', 'acct_1', { m: '1' });
    expect(res.status).toBe('succeeded');
    expect(res.chargeId).toBe('ch_1');
    expect(res.transferId).toBe('tr_1');
  });

  test('handles object latest_charge + non-succeeded status (no transfer lookup)', async () => {
    const fake = makeFakeStripe();
    fake.paymentIntents.capture = mock(async () => ({
      id: 'pi_1',
      status: 'requires_action',
      latest_charge: { id: 'ch_obj' },
    }));
    const res = await makeService(fake).capturePaymentIntent('pi_1', 'acct_1');
    expect(res.chargeId).toBe('ch_obj');
    expect(res.transferId).toBeUndefined();
  });

  test('error path', async () => {
    const fake = makeFakeStripe();
    fake.paymentIntents.capture = mock(async () => { throw new Error('x'); });
    await expect(makeService(fake).capturePaymentIntent('p', 'a')).rejects.toThrow(/Failed to capture payment intent/);
  });
});

describe('BillingService.cancelPaymentIntent', () => {
  test('happy path', async () => {
    const res = await makeService().cancelPaymentIntent('pi_1', 'acct_1', 'reason');
    expect(res.status).toBe('canceled');
  });
  test('error path', async () => {
    const fake = makeFakeStripe();
    fake.paymentIntents.cancel = mock(async () => { throw new Error('x'); });
    await expect(makeService(fake).cancelPaymentIntent('p', 'a')).rejects.toThrow(/Failed to cancel payment intent/);
  });
});

describe('BillingService.createRefund', () => {
  test('happy path', async () => {
    const res = await makeService().createRefund({
      paymentIntentId: 'pi_1',
      amount: 5000,
      reason: 'requested_by_customer',
      connectedAccountId: 'acct_1',
    });
    expect(res.refundId).toBe('re_1');
    expect(res.amount).toBe(5000);
  });

  test('null-ish refund fields fall back to defaults', async () => {
    const fake = makeFakeStripe();
    fake.refunds.create = mock(async () => ({ id: null, status: null, amount: null }));
    const res = await makeService(fake).createRefund({
      paymentIntentId: 'pi_1',
      connectedAccountId: 'acct_1',
    });
    expect(res.refundId).toBe('');
    expect(res.status).toBe('');
    expect(res.amount).toBe(0);
  });

  test('error path', async () => {
    const fake = makeFakeStripe();
    fake.refunds.create = mock(async () => { throw new Error('x'); });
    await expect(makeService(fake).createRefund({ paymentIntentId: 'p', connectedAccountId: 'a' })).rejects.toThrow(/Failed to create refund/);
  });
});

describe('BillingService.verifyWebhookSignature', () => {
  test('happy path returns the constructed event', async () => {
    const evt = await makeService().verifyWebhookSignature('payload', 'sig');
    expect(evt.type).toBe('payment_intent.succeeded');
  });

  test('throws when webhook secret missing', async () => {
    const svc = makeService(makeFakeStripe(), makeConfig({ webhookSecret: undefined }));
    await expect(svc.verifyWebhookSignature('p', 's')).rejects.toThrow(/Invalid webhook signature/);
  });

  test('throws when construct returns falsy', async () => {
    const fake = makeFakeStripe();
    fake.webhooks.constructEventAsync = mock(async () => null);
    await expect(makeService(fake).verifyWebhookSignature('p', 's')).rejects.toThrow(/Invalid webhook signature/);
  });

  test('error path wraps SDK throw', async () => {
    const fake = makeFakeStripe();
    fake.webhooks.constructEventAsync = mock(async () => { throw new Error('bad sig'); });
    await expect(makeService(fake).verifyWebhookSignature('p', 's')).rejects.toThrow(/Invalid webhook signature/);
  });
});

describe('BillingService.getPaymentIntent', () => {
  test('string latest_charge → fetches the charge', async () => {
    const res = await makeService().getPaymentIntent('pi_1', 'acct_1');
    expect(res.id).toBe('pi_1');
    expect(res.charges).toHaveLength(1);
    expect(res.charges[0]!.id).toBe('ch_1');
  });

  test('object latest_charge → used directly', async () => {
    const fake = makeFakeStripe();
    fake.paymentIntents.retrieve = mock(async () => ({
      id: 'pi_1',
      status: 'succeeded',
      amount: 100,
      currency: 'php',
      latest_charge: { id: 'ch_obj', status: 'succeeded', amount: 100 },
    }));
    const res = await makeService(fake).getPaymentIntent('pi_1', 'acct_1');
    expect(res.charges[0]!.id).toBe('ch_obj');
  });

  test('no latest_charge → empty charges array', async () => {
    const fake = makeFakeStripe();
    fake.paymentIntents.retrieve = mock(async () => ({
      id: 'pi_1',
      status: 'succeeded',
      amount: 100,
      currency: 'php',
      latest_charge: null,
    }));
    const res = await makeService(fake).getPaymentIntent('pi_1', 'acct_1');
    expect(res.charges).toHaveLength(0);
  });

  test('error path', async () => {
    const fake = makeFakeStripe();
    fake.paymentIntents.retrieve = mock(async () => { throw new Error('x'); });
    await expect(makeService(fake).getPaymentIntent('p', 'a')).rejects.toThrow(/Failed to get payment intent/);
  });
});

describe('createBillingService factory', () => {
  test('returns a BillingService instance', () => {
    const svc = createBillingService(makeConfig(), {} as any, makeLogger());
    expect(svc).toBeInstanceOf(BillingService);
  });
});
