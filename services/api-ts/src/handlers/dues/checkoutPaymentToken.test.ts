/**
 * Tests for checkoutPaymentToken (VS-W0B-003)
 *
 * Covers:
 * - Valid token initiates Stripe checkout and returns checkoutUrl
 * - Token is marked as used on checkout initiation
 * - Expired token returns error
 * - Already-used token prevents double-pay
 * - Unknown token returns error
 * - Missing Stripe config returns error
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PaymentTokenRepository } from './repos/payment-token.repo';
import { DuesRepository } from '../association:member/repos/dues-payments.repo';
import { checkoutPaymentToken } from './checkoutPaymentToken';

// ─── Fixtures ───────────────────────────────────────────

const validTokenRecord = {
  id: 'pt-1',
  tokenHash: 'hashed-token',
  personId: 'member-1',
  organizationId: 'org-1',
  invoiceId: 'inv-1',
  amount: 500000,
  currency: 'PHP',
  expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  usedAt: null,
  createdByOfficer: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: null,
  updatedBy: null,
};

const gatewayConfig = {
  id: 'gw-1',
  organizationId: 'org-1',
  provider: 'stripe',
  connected: true,
  publicKey: 'pk_test_xxx',
  encryptedSecret: 'sk_test_xxx',
};

function defaultStubs() {
  stubRepo(PaymentTokenRepository, {
    findByTokenHash: async () => validTokenRecord,
    markUsed: async (id: string) => ({ ...validTokenRecord, usedAt: new Date() }),
  });
  stubRepo(DuesRepository, {
    getGatewayConfig: async () => gatewayConfig,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[VS-W0B-003] checkoutPaymentToken', () => {
  beforeEach(() => {
    restoreRepo(PaymentTokenRepository);
    restoreRepo(DuesRepository);
    process.env['PAYMENT_TOKEN_SECRET'] = 'test-secret-key-for-hmac';
  });

  afterEach(() => {
    restoreRepo(PaymentTokenRepository);
    restoreRepo(DuesRepository);
    delete process.env['PAYMENT_TOKEN_SECRET'];
  });

  // ── Happy Path ───────────────────────────────────────

  test('returns checkoutUrl for valid token', async () => {
    defaultStubs();
    const ctx = makeCtx({
      user: null, // Public endpoint
      session: null,
      _params: { token: 'raw-token-value' },
      billing: {
        createPaymentIntent: async () => ({
          paymentIntentId: 'pi_test_123',
          clientSecret: 'cs_test',
          status: 'pending',
          checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_session',
        }),
      },
    });
    const res = await checkoutPaymentToken(ctx);
    expect(res.status).toBe(200);
    expect(res.body.checkoutUrl).toBe('https://checkout.stripe.com/c/pay/cs_test_session');
  });

  test('marks token as used on successful checkout', async () => {
    let markedId: string | null = null;
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => validTokenRecord,
      markUsed: async (id: string) => {
        markedId = id;
        return { ...validTokenRecord, usedAt: new Date() };
      },
    });
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => gatewayConfig,
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'raw-token-value' },
      billing: {
        createPaymentIntent: async () => ({
          paymentIntentId: 'pi_test_123',
          clientSecret: 'cs_test',
          status: 'pending',
          checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_session',
        }),
      },
    });
    await checkoutPaymentToken(ctx);
    expect(markedId).toBe('pt-1');
  });

  // ── Expired Token ────────────────────────────────────

  test('returns 400 for expired token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({
        ...validTokenRecord,
        expiresAt: new Date(Date.now() - 1000),
      }),
    });
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => gatewayConfig,
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'raw-token-value' },
    });
    const res = await checkoutPaymentToken(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('expired');
  });

  // ── Double-Pay Prevention ────────────────────────────

  test('returns 400 for already-used token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({
        ...validTokenRecord,
        usedAt: new Date(),
      }),
    });
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => gatewayConfig,
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'raw-token-value' },
    });
    const res = await checkoutPaymentToken(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('already');
  });

  // ── Unknown Token ────────────────────────────────────

  test('returns 400 for unknown token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => undefined,
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'nonexistent-token' },
    });
    const res = await checkoutPaymentToken(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('invalid');
  });

  // ── Missing Gateway Config ───────────────────────────

  test('returns 400 when no gateway configured for org', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => validTokenRecord,
      markUsed: async () => validTokenRecord,
    });
    stubRepo(DuesRepository, {
      getGatewayConfig: async () => undefined,
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'raw-token-value' },
    });
    const res = await checkoutPaymentToken(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('payment');
  });
});
