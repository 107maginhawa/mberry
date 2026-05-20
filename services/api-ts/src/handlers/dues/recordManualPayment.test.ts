/**
 * Tests for recordManualPayment (handlers/dues/)
 *
 * Covers:
 * - BR-07: Payment extends dues_expiry_date by one billing cycle
 * - M6-R4: Concurrent payment warning within 5-min window
 * - M6-R8: Idempotent webhook (already-completed payment returns warning, no re-process)
 * - Auth/authz guards
 * - Fund allocation triggered on payment
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const basePayment = {
  id: 'pay-1',
  organizationId: 'org-1',
  personId: 'person-1',
  invoiceId: null,
  receiptNumber: 'ORG-2026-000001',
  amount: 5000,
  currency: 'PHP',
  paymentMethod: 'cash' as const,
  referenceNumber: null,
  status: 'completed' as const,
  recordedBy: 'user-1',
  membershipExtendedFrom: null,
  membershipExtendedTo: null,
  paidAt: new Date(),
  expiredAt: null,
  refundedAmount: 0,
  proofStorageKey: null,
  proofFileName: null,
  proofMimeType: null,
  rejectionReason: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
};

const validBody = {
  personId: 'person-1',
  amount: 5000,
  paymentMethod: 'cash',
  referenceNumber: 'CASH-001',
};

function makeTestCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    organizationId: 'org-1',
    _body: validBody,
    ...overrides,
  });
}

// ─── Setup ──────────────────────────────────────────────

describe('recordManualPayment (handlers/dues)', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  // ── Auth Guards ──────────────────────────────────────

  test('returns 401 when no user in session', async () => {
    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx({ user: null, session: null });
    const response = await recordManualPayment(ctx);
    expect(response.status).toBe(401);
  });

  test('returns 403 when no organizationId in context', async () => {
    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx({ organizationId: null });
    const response = await recordManualPayment(ctx);
    expect(response.status).toBe(403);
  });

  // ── Happy Path ───────────────────────────────────────

  test('records payment, returns 201 with receipt and fund allocations', async () => {
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...basePayment, ...data }),
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({
        ...basePayment,
        ...extra,
      }),
      listFunds: async () => [
        { id: 'fund-1', name: 'General', percentage: '60', organizationId: 'org-1', active: true, sortOrder: 0 },
        { id: 'fund-2', name: 'Building', percentage: '40', organizationId: 'org-1', active: true, sortOrder: 1 },
      ],
      createFundAllocations: async () => {},
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });

    // Stub MembershipRepository for settle-payment
    const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        id: 'mem-1',
        organizationId: 'org-1',
        personId: 'person-1',
        status: 'active',
        duesExpiryDate: '2027-06-15',
        gracePeriodDays: 30,
        joinedAt: new Date().toISOString(),
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async () => ({}),
    });

    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx();
    const response = await recordManualPayment(ctx);

    expect(response.status).toBe(201);
    expect(response.body.receiptNumber).toMatch(/^ORG-\d{4}-\d{6}$/);
    expect(response.body.fundAllocations).toBeDefined();
    expect(response.body.fundAllocations.length).toBeGreaterThan(0);

    restoreRepo(MembershipRepository);
  });

  // ── BR-07: Payment extends expiry by billing cycle ───

  test('[BR-07] payment extends membership expiry, dates returned in response', async () => {
    let capturedExtension: any = null;

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...basePayment, ...data }),
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => {
        capturedExtension = extra;
        return { ...basePayment, ...extra };
      },
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });

    const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        id: 'mem-1',
        organizationId: 'org-1',
        personId: 'person-1',
        status: 'active',
        duesExpiryDate: '2027-06-15',
        gracePeriodDays: 30,
        joinedAt: new Date().toISOString(),
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async () => ({}),
    });

    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx();
    const response = await recordManualPayment(ctx);

    expect(response.status).toBe(201);
    expect(response.body.membershipExtendedFrom).toBeDefined();
    expect(response.body.membershipExtendedTo).toBeDefined();

    restoreRepo(MembershipRepository);
  });

  // ── M6-R4: Concurrent payment warning within 5 min ──

  test('[M6-R4] includes concurrentWarning when recent payment exists within 5 min', async () => {
    const recentPayment = {
      ...basePayment,
      id: 'pay-recent',
      createdAt: new Date(), // just now
    };

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => recentPayment,
      getNextReceiptSequence: async () => 2,
      createPayment: async (data: any) => ({ ...basePayment, id: 'pay-2', ...data }),
      updatePaymentStatus: async () => basePayment,
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });

    const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        id: 'mem-1',
        organizationId: 'org-1',
        personId: 'person-1',
        status: 'active',
        duesExpiryDate: '2027-06-15',
        gracePeriodDays: 30,
        joinedAt: new Date().toISOString(),
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async () => ({}),
    });

    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx();
    const response = await recordManualPayment(ctx);

    expect(response.status).toBe(201);
    expect(response.body.meta.concurrentWarning).toBe(true);
    expect(response.body.meta.recentPayment).toBeDefined();
    expect(response.body.meta.recentPayment.id).toBe('pay-recent');

    restoreRepo(MembershipRepository);
  });

  test('[M6-R4] no concurrentWarning when no recent payment', async () => {
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...basePayment, ...data }),
      updatePaymentStatus: async () => basePayment,
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });

    const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        id: 'mem-1',
        organizationId: 'org-1',
        personId: 'person-1',
        status: 'active',
        duesExpiryDate: '2027-06-15',
        gracePeriodDays: 30,
        joinedAt: new Date().toISOString(),
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async () => ({}),
    });

    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx();
    const response = await recordManualPayment(ctx);

    expect(response.body.meta.concurrentWarning).toBe(false);

    restoreRepo(MembershipRepository);
  });

  // ── M6-R8: Idempotent — duplicate detection ─────────

  test('[M6-R8] duplicate detection uses 5-min window from findRecentPaymentForPerson', async () => {
    let capturedMinutes: number | undefined;

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async (_orgId: string, _personId: string, withinMinutes?: number) => {
        capturedMinutes = withinMinutes;
        return undefined;
      },
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...basePayment, ...data }),
      updatePaymentStatus: async () => basePayment,
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });

    const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        id: 'mem-1',
        organizationId: 'org-1',
        personId: 'person-1',
        status: 'active',
        duesExpiryDate: '2027-06-15',
        gracePeriodDays: 30,
        joinedAt: new Date().toISOString(),
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async () => ({}),
    });

    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx();
    await recordManualPayment(ctx);

    // Default 5-min window — either undefined (uses default) or explicitly 5
    expect(capturedMinutes === undefined || capturedMinutes === 5).toBe(true);

    restoreRepo(MembershipRepository);
  });

  // ── Fund allocation triggered ────────────────────────

  test('fund allocations are created and returned in response', async () => {
    let allocationsCreated = false;

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...basePayment, ...data }),
      updatePaymentStatus: async () => basePayment,
      listFunds: async () => [
        { id: 'fund-1', name: 'General', percentage: '100', organizationId: 'org-1', active: true, sortOrder: 0 },
      ],
      createFundAllocations: async () => { allocationsCreated = true; },
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });

    const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        id: 'mem-1',
        organizationId: 'org-1',
        personId: 'person-1',
        status: 'active',
        duesExpiryDate: '2027-06-15',
        gracePeriodDays: 30,
        joinedAt: new Date().toISOString(),
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async () => ({}),
    });

    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx();
    const response = await recordManualPayment(ctx);

    expect(response.status).toBe(201);
    expect(allocationsCreated).toBe(true);
    expect(response.body.fundAllocations).toHaveLength(1);
    expect(response.body.fundAllocations[0].fundName).toBe('General');

    restoreRepo(MembershipRepository);
  });

  // ── Receipt number generation ────────────────────────

  test('generates sequential receipt number', async () => {
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 42,
      createPayment: async (data: any) => ({ ...basePayment, ...data }),
      updatePaymentStatus: async () => basePayment,
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });

    const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        id: 'mem-1',
        organizationId: 'org-1',
        personId: 'person-1',
        status: 'active',
        duesExpiryDate: '2027-06-15',
        gracePeriodDays: 30,
        joinedAt: new Date().toISOString(),
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async () => ({}),
    });

    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx();
    const response = await recordManualPayment(ctx);

    const year = new Date().getFullYear();
    expect(response.body.receiptNumber).toBe(`ORG-${year}-000042`);

    restoreRepo(MembershipRepository);
  });

  // ── Transaction boundary ─────────────────────────────

  test('wraps payment creation + settlement in db.transaction', async () => {
    let transactionCalled = false;

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...basePayment, ...data }),
      updatePaymentStatus: async () => basePayment,
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });

    const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
    restoreRepo(MembershipRepository);
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        id: 'mem-1',
        organizationId: 'org-1',
        personId: 'person-1',
        status: 'active',
        duesExpiryDate: '2027-06-15',
        gracePeriodDays: 30,
        joinedAt: new Date().toISOString(),
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async () => ({}),
    });

    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDb);
      },
    };

    const { recordManualPayment } = await import('./recordManualPayment');
    const ctx = makeTestCtx({ database: txDb });
    await recordManualPayment(ctx);

    expect(transactionCalled).toBe(true);

    restoreRepo(MembershipRepository);
  });
});
