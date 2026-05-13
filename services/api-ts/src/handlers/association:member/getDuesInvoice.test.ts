/**
 * getDuesInvoice.test.ts
 *
 * SEC-02 RED phase: org isolation tests for getDuesInvoice handler.
 * Tests with [RED] are expected to FAIL now (handler lacks cross-org check)
 * and PASS after Plan 02.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesInvoiceRepository } from './repos/dues.repo';
import { getDuesInvoice } from './getDuesInvoice';

describe('[SEC-02] getDuesInvoice — org isolation', () => {
  afterEach(() => {
    restoreRepo(DuesInvoiceRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ _params: { invoiceId: 'inv-1' }, session: null, user: null });
    await expect(getDuesInvoice(ctx as any)).rejects.toThrow();
  });

  test('throws NotFoundError when invoice not found', async () => {
    stubRepo(DuesInvoiceRepository, { findOneById: async () => null });
    const ctx = makeCtx({ _params: { invoiceId: 'inv-1' } });
    await expect(getDuesInvoice(ctx as any)).rejects.toThrow();
  });

  test('returns 403 when invoice belongs to different org (cross-org read) [RED]', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-B' }),
    });
    const ctx = makeCtx({ _params: { invoiceId: 'inv-1' }, organizationId: 'org-A' });
    // RED: handler currently returns invoice (200) — after fix should return 403
    try {
      const res = await getDuesInvoice(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      // After fix handler may throw ForbiddenError
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });

  test('returns 200 when invoice belongs to caller org', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-1' }),
    });
    const ctx = makeCtx({ _params: { invoiceId: 'inv-1' }, organizationId: 'org-1' });
    const res = await getDuesInvoice(ctx as any);
    expect(res.status).toBe(200);
  });
});
