/**
 * Tests for checkoutPaymentToken (VS-W0B-003) — PayMongo, claim-then-call.
 *
 * Unit-level token-gate + claim/reuse behaviour with the repo + PayMongo adapter
 * stubbed (no DB, no network). The concurrent single-session invariant and the
 * remint/retry paths are proven against REAL Postgres in
 * `checkoutPaymentToken.integration.test.ts`.
 *
 * Covers:
 * - Valid token claims and returns the PayMongo checkout url (200)
 * - Checkout does NOT mark the token used (usedAt is stamped by the webhook)
 * - Expired token → 410, already-used → 409, revoked → 410, unknown → 400
 * - Org with no connected gateway → GatewayNotConfiguredError (→ 400 via middleware)
 * - PayMongo failure → 502 and the claim is released (retryable)
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PaymentTokenRepository } from '@/handlers/dues/repos/payment-token.repo';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { PayMongoAdapter } from '@/handlers/association:member/utils/paymongo.adapter';
import { encryptCredential } from '@/core/gateway';
import { checkoutPaymentToken } from './checkoutPaymentToken';

// ─── Fixtures ───────────────────────────────────────────

const AUTH_SECRET = 'unit-auth-secret';

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
  revokedAt: null,
  paymongoSessionId: null,
  checkoutStartedAt: null,
  idempotencyKey: null,
  createdByOfficer: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
  createdBy: null,
  updatedBy: null,
};

/** A connected PayMongo gateway config whose secret decrypts under AUTH_SECRET. */
const paymongoConfig = {
  id: 'gw-1',
  organizationId: 'org-1',
  provider: 'paymongo',
  connected: true,
  publicKey: 'pk_test_xxx',
  encryptedSecret: encryptCredential('sk_test_xxx', AUTH_SECRET),
  encryptedWebhookSecret: null,
};

function stubDuesLedger() {
  stubRepo(DuesRepository, {
    getGatewayConfig: async () => paymongoConfig,
    getOrgReceiptPrefix: async () => 'ORG',
    getNextReceiptSequence: async () => 1,
    createPayment: async (data: any) => ({ id: 'online-pay-1', ...data }),
  });
}

function ctxFor(token: string) {
  return makeCtx({
    user: null, // public endpoint
    session: null,
    _params: { token },
    config: { auth: { secret: AUTH_SECRET } },
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[VS-W0B-003] checkoutPaymentToken', () => {
  beforeEach(() => {
    restoreRepo(PaymentTokenRepository);
    restoreRepo(DuesRepository);
    restoreRepo(PayMongoAdapter);
    process.env['PAYMENT_TOKEN_SECRET'] = 'test-secret-key-for-hmac';
  });

  afterEach(() => {
    restoreRepo(PaymentTokenRepository);
    restoreRepo(DuesRepository);
    restoreRepo(PayMongoAdapter);
    delete process.env['PAYMENT_TOKEN_SECRET'];
  });

  // ── Happy Path ───────────────────────────────────────

  test('returns checkoutUrl for valid token', async () => {
    let attached: string | null = null;
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => validTokenRecord,
      claimForCheckout: async () => ({ ...validTokenRecord, idempotencyKey: 'idem-1' }),
      attachSession: async (_id: string, sessionId: string) => { attached = sessionId; },
    });
    stubDuesLedger();
    stubRepo(PayMongoAdapter, {
      createCheckout: async () => ({
        checkoutUrl: 'https://checkout.paymongo.com/cs_test_session',
        sessionId: 'cs_test_session',
      }),
    });

    const res = (await checkoutPaymentToken(ctxFor('raw-token-value'))) as any;
    expect(res.status).toBe(200);
    expect(res.body.checkoutUrl).toBe('https://checkout.paymongo.com/cs_test_session');
    // The created session id is persisted to the token's active attempt.
    expect(attached).toBe('cs_test_session');
  });

  test('does NOT mark token used on checkout (usedAt is set by the webhook)', async () => {
    let markUsedCalled = false;
    let markUsedCasCalled = false;
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => validTokenRecord,
      claimForCheckout: async () => ({ ...validTokenRecord, idempotencyKey: 'idem-1' }),
      attachSession: async () => {},
      markUsed: async () => { markUsedCalled = true; return validTokenRecord; },
      markUsedCas: async () => { markUsedCasCalled = true; return true; },
    });
    stubDuesLedger();
    stubRepo(PayMongoAdapter, {
      createCheckout: async () => ({ checkoutUrl: 'https://checkout.paymongo.com/cs', sessionId: 'cs' }),
    });

    const res = (await checkoutPaymentToken(ctxFor('raw-token-value'))) as any;
    expect(res.status).toBe(200);
    expect(markUsedCalled).toBe(false);
    expect(markUsedCasCalled).toBe(false);
  });

  // ── Token gate ───────────────────────────────────────

  test('returns 410 for expired token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({ ...validTokenRecord, expiresAt: new Date(Date.now() - 1000) }),
    });
    const res = (await checkoutPaymentToken(ctxFor('raw-token-value'))) as any;
    expect(res.status).toBe(410);
    expect(res.body.error).toContain('expired');
  });

  test('returns 409 for already-used token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({ ...validTokenRecord, usedAt: new Date() }),
    });
    const res = (await checkoutPaymentToken(ctxFor('raw-token-value'))) as any;
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already');
  });

  test('returns 410 for revoked token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => ({ ...validTokenRecord, revokedAt: new Date() }),
    });
    const res = (await checkoutPaymentToken(ctxFor('raw-token-value'))) as any;
    expect(res.status).toBe(410);
    expect(res.body.error).toContain('revoked');
  });

  test('returns 400 for unknown token', async () => {
    stubRepo(PaymentTokenRepository, { findByTokenHash: async () => undefined });
    const res = (await checkoutPaymentToken(ctxFor('nonexistent-token'))) as any;
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('invalid');
  });

  // ── Missing Gateway Config ───────────────────────────

  test('throws GatewayNotConfiguredError when no gateway configured for org (→ 400 via middleware)', async () => {
    stubRepo(PaymentTokenRepository, { findByTokenHash: async () => validTokenRecord });
    stubRepo(DuesRepository, { getGatewayConfig: async () => undefined });
    await expect(checkoutPaymentToken(ctxFor('raw-token-value'))).rejects.toThrow(/not configured/i);
  });

  // ── PayMongo failure → retryable ─────────────────────

  test('returns 502 and releases the claim when PayMongo fails', async () => {
    let cleared = false;
    stubRepo(PaymentTokenRepository, {
      findByTokenHash: async () => validTokenRecord,
      claimForCheckout: async () => ({ ...validTokenRecord, idempotencyKey: 'idem-1' }),
      clearCheckoutClaim: async () => { cleared = true; },
    });
    stubDuesLedger();
    stubRepo(PayMongoAdapter, {
      createCheckout: async () => { throw new Error('PayMongo down'); },
    });

    const res = (await checkoutPaymentToken(ctxFor('raw-token-value'))) as any;
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/try again/i);
    // The lease is released so the next tap can re-claim (retryable).
    expect(cleared).toBe(true);
  });
});
