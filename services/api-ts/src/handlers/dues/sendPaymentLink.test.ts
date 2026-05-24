/**
 * Tests for sendPaymentLink (VS-W0B-003)
 *
 * Covers:
 * - Auth guard (401 without user)
 * - Org context guard (403 without orgId)
 * - Token generation and response shape
 * - Amount lookup from dues config when not provided
 * - personId required in body
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PaymentTokenRepository } from './repos/payment-token.repo';
import { DuesRepository } from '../association:member/repos/dues-payments.repo';
import { sendPaymentLink } from './sendPaymentLink';

// ─── Fixtures ───────────────────────────────────────────

const createdToken = {
  id: 'pt-1',
  tokenHash: 'hashed-token',
  personId: 'member-1',
  organizationId: 'org-1',
  invoiceId: null,
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

const duesConfig = {
  id: 'config-1',
  organizationId: 'org-1',
  defaultAmount: 500000,
  currency: 'PHP',
  billingFrequency: 'annual',
  dueDateMonth: 1,
  dueDateDay: 1,
  gracePeriodDays: 30,
};

function defaultStubs() {
  stubRepo(PaymentTokenRepository, {
    create: async (data: any) => ({ ...createdToken, ...data }),
  });
  stubRepo(DuesRepository, {
    getConfig: async () => duesConfig,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[VS-W0B-003] sendPaymentLink', () => {
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

  // ── Auth Guards ──────────────────────────────────────

  test('throws UnauthorizedError without user', async () => {
    const ctx = makeCtx({ user: null, session: null, _body: { personId: 'member-1' } });
    await expect(sendPaymentLink(ctx)).rejects.toThrow();
  });

  test('returns 403 without organizationId', async () => {
    const ctx = makeCtx({ organizationId: null, _body: { personId: 'member-1' } });
    const res = await sendPaymentLink(ctx);
    expect(res.status).toBe(403);
    expect((res as any).body.error).toBeDefined();
  });

  // ── Validation ───────────────────────────────────────

  test('returns 400 when personId missing from body', async () => {
    defaultStubs();
    const ctx = makeCtx({
      organizationId: 'org-1',
      _body: {},
    });
    const res = await sendPaymentLink(ctx);
    expect(res.status).toBe(400);
    expect((res as any).body.error).toBeDefined();
  });

  // ── Happy Path ───────────────────────────────────────

  test('generates token and returns 201 with token + paymentUrl + expiresAt', async () => {
    defaultStubs();
    const ctx = makeCtx({
      organizationId: 'org-1',
      user: { id: 'officer-1', role: 'officer' },
      _body: { personId: 'member-1', amount: 500000 },
    });
    const res = await sendPaymentLink(ctx);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.paymentUrl).toContain('/pay/');
    expect(res.body.expiresAt).toBeDefined();
  });

  test('uses dues config amount when no amount provided', async () => {
    let capturedData: any = null;
    stubRepo(PaymentTokenRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...createdToken, ...data };
      },
    });
    stubRepo(DuesRepository, {
      getConfig: async () => duesConfig,
    });
    const ctx = makeCtx({
      organizationId: 'org-1',
      user: { id: 'officer-1', role: 'officer' },
      _body: { personId: 'member-1' },
    });
    await sendPaymentLink(ctx);
    expect(capturedData.amount).toBe(500000);
  });

  test('uses provided amount over config default', async () => {
    let capturedData: any = null;
    stubRepo(PaymentTokenRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...createdToken, ...data };
      },
    });
    stubRepo(DuesRepository, {
      getConfig: async () => duesConfig,
    });
    const ctx = makeCtx({
      organizationId: 'org-1',
      user: { id: 'officer-1', role: 'officer' },
      _body: { personId: 'member-1', amount: 250000 },
    });
    await sendPaymentLink(ctx);
    expect(capturedData.amount).toBe(250000);
  });

  test('passes invoiceId when provided', async () => {
    let capturedData: any = null;
    stubRepo(PaymentTokenRepository, {
      create: async (data: any) => {
        capturedData = data;
        return { ...createdToken, ...data };
      },
    });
    stubRepo(DuesRepository, {
      getConfig: async () => duesConfig,
    });
    const ctx = makeCtx({
      organizationId: 'org-1',
      user: { id: 'officer-1', role: 'officer' },
      _body: { personId: 'member-1', amount: 500000, invoiceId: 'inv-1' },
    });
    await sendPaymentLink(ctx);
    expect(capturedData.invoiceId).toBe('inv-1');
  });

  test('returns 400 when no amount and no dues config', async () => {
    stubRepo(PaymentTokenRepository, {
      create: async (data: any) => ({ ...createdToken, ...data }),
    });
    stubRepo(DuesRepository, {
      getConfig: async () => undefined,
    });
    const ctx = makeCtx({
      organizationId: 'org-1',
      user: { id: 'officer-1', role: 'officer' },
      _body: { personId: 'member-1' },
    });
    const res = await sendPaymentLink(ctx);
    expect(res.status).toBe(400);
    expect((res as any).body.error).toBeDefined();
  });
});
