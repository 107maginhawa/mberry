/**
 * Tests for validatePaymentToken (VS-W0B-003)
 *
 * Covers:
 * - Valid token returns member/org details
 * - Expired token returns { valid: false }
 * - Already-used token returns { status: "already_paid" }
 * - Invalid/unknown token returns { valid: false }
 * - Member and org name resolution via join
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PaymentTokenRepository } from './repos/payment-token.repo';
import { validatePaymentToken } from './validatePaymentToken';

// ─── Fixtures ───────────────────────────────────────────

const validToken = {
  token: {
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
  },
  memberName: 'Juan Dela Cruz',
  orgName: 'Philippine Dental Association',
};

function defaultStubs() {
  stubRepo(PaymentTokenRepository, {
    findByTokenHashWithDetails: async () => validToken,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[VS-W0B-003] validatePaymentToken', () => {
  beforeEach(() => {
    restoreRepo(PaymentTokenRepository);
    process.env['PAYMENT_TOKEN_SECRET'] = 'test-secret-key-for-hmac';
  });

  afterEach(() => {
    restoreRepo(PaymentTokenRepository);
    delete process.env['PAYMENT_TOKEN_SECRET'];
  });

  // ── Valid Token ──────────────────────────────────────

  test('returns valid=true with payment details for valid token', async () => {
    defaultStubs();
    const ctx = makeCtx({
      user: null, // Public endpoint, no auth
      session: null,
      _params: { token: 'raw-token-value' },
    });
    const res = await validatePaymentToken(ctx);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.amount).toBe(500000);
    expect(res.body.currency).toBe('PHP');
    expect(res.body.memberName).toBe('Juan Dela Cruz');
    expect(res.body.orgName).toBe('Philippine Dental Association');
    expect(res.body.invoiceId).toBe('inv-1');
  });

  // ── Expired Token ────────────────────────────────────

  test('returns valid=false for expired token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHashWithDetails: async () => ({
        ...validToken,
        token: {
          ...validToken.token,
          expiresAt: new Date(Date.now() - 1000), // expired
        },
      }),
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'raw-token-value' },
    });
    const res = await validatePaymentToken(ctx);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toContain('expired');
  });

  // ── Already Used ─────────────────────────────────────

  test('returns status=already_paid for used token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHashWithDetails: async () => ({
        ...validToken,
        token: {
          ...validToken.token,
          usedAt: new Date(), // already used
        },
      }),
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'raw-token-value' },
    });
    const res = await validatePaymentToken(ctx);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.status).toBe('already_paid');
  });

  // ── Invalid Token ────────────────────────────────────

  test('returns valid=false for unknown token', async () => {
    stubRepo(PaymentTokenRepository, {
      findByTokenHashWithDetails: async () => undefined,
    });
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: 'invalid-token' },
    });
    const res = await validatePaymentToken(ctx);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toContain('invalid');
  });
});
