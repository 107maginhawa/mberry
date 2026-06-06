/**
 * downloadReceipt handler tests — RED phase
 *
 * Business rules (M6-R6):
 * - Returns receipt HTML for a completed payment
 * - Auth required: member (own payment) or officer (any payment in org)
 * - Only completed/confirmed payments have receipts
 * - Returns 404 if payment not found
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues-payments.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { BusinessLogicError } from '@/core/errors';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

// ─── Fixtures ───────────────────────────────────────────

const completedPayment = {
  id: 'pay-1',
  organizationId: 'org-1',
  personId: 'user-1',
  receiptNumber: 'PDA-2026-000001',
  amount: 250000, // 2500.00 PHP in cents
  currency: 'PHP',
  paymentMethod: 'online',
  status: 'completed',
  paidAt: new Date('2026-05-15T10:00:00Z'),
  createdAt: new Date('2026-05-15T09:55:00Z'),
};

const pendingPayment = { ...completedPayment, status: 'pending' };

// ─── Tests ──────────────────────────────────────────────

describe('downloadReceipt', () => {
  let downloadReceipt: typeof import('./downloadReceipt').downloadReceipt;

  beforeEach(async () => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
    // Default: user is officer
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
    });
    downloadReceipt = (await import('./downloadReceipt')).downloadReceipt;
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('returns receipt HTML for completed payment with 200', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => completedPayment,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', paymentId: 'pay-1' },
    });
    const response = await downloadReceipt(ctx);

    expect(response.status).toBe(200);
    expect(response.body.html).toContain('PDA-2026-000001');
    expect(response.body.contentType).toBe('text/html');
  });

  test('member can download own receipt', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    stubRepo(DuesRepository, {
      getPayment: async () => completedPayment, // personId matches session user
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', paymentId: 'pay-1' },
    });
    const response = await downloadReceipt(ctx);
    expect(response.status).toBe(200);
  });

  test('throws ForbiddenError when non-officer tries to access other member receipt', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...completedPayment, personId: 'other-user' }),
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', paymentId: 'pay-1' },
    });
    await expect(downloadReceipt(ctx)).rejects.toThrow('access');
  });

  test('throws RECEIPT_NOT_AVAILABLE when payment is pending', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => pendingPayment,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', paymentId: 'pay-1' },
    });
    const err = await downloadReceipt(ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessLogicError);
    expect((err as BusinessLogicError).code).toBe('RECEIPT_NOT_AVAILABLE');
  });

  test('throws NotFoundError when payment does not exist', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1', paymentId: 'missing' },
    });
    await expect(downloadReceipt(ctx)).rejects.toThrow('Payment not found');
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1', paymentId: 'pay-1' },
    });
    await expect(downloadReceipt(ctx)).rejects.toThrow('Unauthorized');
  });
});
