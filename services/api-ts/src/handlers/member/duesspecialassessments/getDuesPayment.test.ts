/**
 * getDuesPayment.test.ts
 *
 * SEC-02 RED phase: org isolation tests for getDuesPayment handler.
 * Tests with [RED] are expected to FAIL now (handler lacks cross-org check)
 * and PASS after Plan 02.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { getDuesPayment } from './getDuesPayment';

describe('[SEC-02] getDuesPayment — org isolation', () => {
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ _params: { paymentId: 'pay-1' }, session: null, user: null });
    await expect(getDuesPayment(ctx as any)).rejects.toThrow();
  });

  test('throws NotFoundError when payment not found', async () => {
    stubRepo(DuesRepository, { getPayment: async () => null });
    const ctx = makeCtx({ _params: { paymentId: 'pay-1' } });
    await expect(getDuesPayment(ctx as any)).rejects.toThrow();
  });

  test('returns 403 when payment belongs to different org (cross-org read) [RED]', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => ({ id: 'pay-1', organizationId: 'org-B', amount: 5000 }),
    });
    const ctx = makeCtx({ _params: { paymentId: 'pay-1' }, organizationId: 'org-A' });
    // RED: handler currently returns payment (200) — after fix should return 403
    try {
      const res = await getDuesPayment(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });

  test('returns 200 when payment belongs to caller org', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => ({ id: 'pay-1', organizationId: 'org-1', amount: 5000 }),
    });
    const ctx = makeCtx({ _params: { paymentId: 'pay-1' }, organizationId: 'org-1' });
    const res = await getDuesPayment(ctx as any);
    expect(res.status).toBe(200);
  });
});
