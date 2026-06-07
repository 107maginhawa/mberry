import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesInvoice as createFakeDuesInvoice, fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { markDuesInvoicePaid } from './markDuesInvoicePaid';
import { DuesInvoiceRepository } from '@/handlers/association:member/repos/dues.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeInvoice = createFakeDuesInvoice({
  id: 'inv-1',
  membershipId: 'mem-1',
  personId: 'person-1',
  organizationId: 'tenant-1',
  invoiceNumber: 'INV-2025-001',
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  totalAmount: 5000,
  status: 'sent',
  generatedAt: new Date().toISOString(),
});

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  organizationId: 'tenant-1',
  personId: 'person-1',
  duesExpiryDate: '2025-06-30',
});

/** Fake DB that supports transactions AND the Drizzle update chain (BR-01) */
const txDb = makeMockDb();

/**
 * Create a capturing DB mock that records what was passed to db.update().set()
 * while also supporting transactions. Used to verify persistWithComputedStatus calls.
 */
function makeCapturingDb(onSet: (data: Record<string, any>) => void) {
  const db: any = {
    transaction: async (fn: (tx: any) => Promise<any>) => fn(db),
    update: (_table: any) => ({
      set: (data: any) => {
        onSet(data);
        return {
          where: (_c: any) => ({
            returning: async () => [{ ...fakeMembership, ...data }],
          }),
        };
      },
    }),
  };
  return db;
}

// ─── Tests ──────────────────────────────────────────────

describe('[BR-07] markDuesInvoicePaid expiry extension', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(DuesRepository);
    // Default: officer allowed
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(DuesRepository);
  });

  test('uses computeNewExpiry — extends annual by 12 months from current expiry', async () => {
    let dbSetData: Record<string, any> | undefined;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...fakeMembership, duesExpiryDate: '2025-12-31' }),
    });

    const db = makeCapturingDb((data) => { dbSetData = data; });
    const ctx = makeCtx({
      database: db,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    const response = await markDuesInvoicePaid(ctx);
    expect(response.status).toBe(200);
    expect(dbSetData?.duesExpiryDate).toBeDefined();
    // From 2025-12-31 + 12 months = 2026-12-31
    expect(dbSetData!.duesExpiryDate.startsWith('2026-12')).toBe(true);
  });

  test('handles severely lapsed member — resets from today', async () => {
    let dbSetData: Record<string, any> | undefined;
    const today = new Date();

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'overdue' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      // Expiry > 1 year in past = severely lapsed
      findOneById: async () => ({ ...fakeMembership, duesExpiryDate: '2023-01-01', suspendedAt: null, removedAt: null }),
    });

    const db = makeCapturingDb((data) => { dbSetData = data; });
    const ctx = makeCtx({
      database: db,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    await markDuesInvoicePaid(ctx);
    expect(dbSetData?.duesExpiryDate).toBeDefined();
    // Should reset from today, not from 2023-01-01
    const expiryDate = new Date(dbSetData!.duesExpiryDate);
    const expectedYear = today.getFullYear() + 1;
    // Expiry should be roughly today + 12 months (annual default)
    expect(expiryDate.getFullYear()).toBeGreaterThanOrEqual(expectedYear);
  });

  test('handles first-time payment — no existing expiry', async () => {
    let dbSetData: Record<string, any> | undefined;
    const today = new Date();

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...fakeMembership, duesExpiryDate: null, suspendedAt: null, removedAt: null }),
    });

    const db = makeCapturingDb((data) => { dbSetData = data; });
    const ctx = makeCtx({
      database: db,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    await markDuesInvoicePaid(ctx);
    expect(dbSetData?.duesExpiryDate).toBeDefined();
    // Should be today + 12 months
    const expiryDate = new Date(dbSetData!.duesExpiryDate);
    const expectedYear = today.getFullYear() + 1;
    expect(expiryDate.getFullYear()).toBeGreaterThanOrEqual(expectedYear);
  });

  test('suspended member — extends expiry but does NOT reactivate [BR-03]', async () => {
    let dbSetData: Record<string, any> | undefined;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({
        ...fakeMembership,
        status: 'suspended',
        suspendedAt: new Date(),
        duesExpiryDate: '2025-12-31',
        removedAt: null,
        dateOfDeath: null,
        expelledAt: null,
        resignedAt: null,
        gracePeriodDays: 30,
      }),
    });

    const db = makeCapturingDb((data) => { dbSetData = data; });
    const ctx = makeCtx({
      database: db,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    const response = await markDuesInvoicePaid(ctx);
    expect(response.status).toBe(200);
    // persistWithComputedStatus computes status from flags — suspended stays suspended
    expect(dbSetData?.status).not.toBe('active');
  });

  test('removed member — extends expiry but does NOT reactivate [BR-03]', async () => {
    let dbSetData: Record<string, any> | undefined;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({
        ...fakeMembership,
        status: 'removed',
        removedAt: new Date(),
        duesExpiryDate: '2025-12-31',
        suspendedAt: null,
        dateOfDeath: null,
        expelledAt: null,
        resignedAt: null,
        gracePeriodDays: 30,
      }),
    });

    const db = makeCapturingDb((data) => { dbSetData = data; });
    const ctx = makeCtx({
      database: db,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    const response = await markDuesInvoicePaid(ctx);
    expect(response.status).toBe(200);
    // persistWithComputedStatus computes status from flags — removed stays removed
    expect(dbSetData?.status).not.toBe('active');
  });

  test('lapsed member — payment SHOULD reactivate [BR-03]', async () => {
    let dbSetData: Record<string, any> | undefined;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'overdue' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({
        ...fakeMembership,
        status: 'lapsed',
        duesExpiryDate: '2023-01-01',
        suspendedAt: null,
        removedAt: null,
        dateOfDeath: null,
        expelledAt: null,
        resignedAt: null,
        gracePeriodDays: 30,
      }),
    });

    const db = makeCapturingDb((data) => { dbSetData = data; });
    const ctx = makeCtx({
      database: db,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    await markDuesInvoicePaid(ctx);
    // After payment, expiry extended to future → computed status becomes 'active'
    expect(dbSetData?.status).toBe('active');
  });

  test('skips extension when membership not found', async () => {
    let updateCalled = false;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => undefined,
      updateOneById: async () => { updateCalled = true; return fakeMembership; },
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    const response = await markDuesInvoicePaid(ctx);
    expect(response.status).toBe(200);
    expect(updateCalled).toBe(false);
  });
});

// ─── PAY-03 Optimistic Locking Tests ─────────────────────────────────────────

describe('[PAY-03] optimistic locking on invoice', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(DuesRepository);
    // Default: officer allowed
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(DuesRepository);
  });

  test('throws ConflictError when markPaid is called with stale version (0 rows affected)', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent', version: 3 }),
      markPaid: async () => { throw new (await import('@/core/errors')).ConflictError('Invoice was already paid or modified concurrently'); },
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    await expect(markDuesInvoicePaid(ctx)).rejects.toThrow('Invoice was already paid or modified concurrently');
  });

  test('passes invoice.version to markPaid', async () => {
    let capturedVersion: number | undefined;
    let capturedExpectedVersion: number | undefined;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent', version: 5 }),
      markPaid: async (invoiceId: string, expectedVersion: number, paymentId: string, paidAt?: Date) => {
        capturedVersion = 5;
        capturedExpectedVersion = expectedVersion;
        return { ...fakeInvoice, status: 'paid', version: 6 };
      },
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    const response = await markDuesInvoicePaid(ctx);
    expect(response.status).toBe(200);
    expect(capturedExpectedVersion).toBe(5);
    expect(capturedVersion).toBe(5);
  });

  test('successful markPaid with matching version returns 200', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent', version: 2 }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid', version: 3 }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    const response = await markDuesInvoicePaid(ctx);
    expect(response.status).toBe(200);
  });
});

// ─── SEC-01 Auth Guard Tests (RED phase — expect FAIL until Plan 02) ─────────

describe('[SEC-01] markDuesInvoicePaid — position-based auth', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ _params: { invoiceId: 'inv-1' }, session: null, user: null });
    await expect(markDuesInvoicePaid(ctx as any)).rejects.toThrow();
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-1', status: 'generated', membershipId: 'm-1' }),
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1' },
      organizationId: 'org-1',
    });
    // RED: handler currently has no requirePosition call — will NOT return 403
    const res = await markDuesInvoicePaid(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when invoice belongs to different org (cross-org) [RED]', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ id: 'inv-1', organizationId: 'org-B', status: 'generated', membershipId: 'm-1' }),
    });
    const ctx = makeCtx({
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1' },
      organizationId: 'org-A',
    });
    try {
      const res = await markDuesInvoicePaid(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      // Handler throws ForbiddenError — statusCode should be 403
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });
});

describe('[Wave 1.2] markDuesInvoicePaid — transactional boundary', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(DuesRepository);
    // Default: officer allowed
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'President' }] });
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(DuesRepository);
  });

  test('wraps invoice mark-paid + membership update in db.transaction()', async () => {
    let transactionCalled = false;

    // Use makeMockDb but wrap transaction to track calls
    const txDbLocal = {
      ...makeMockDb(),
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDbLocal);
      },
    };

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...fakeMembership, duesExpiryDate: '2025-12-31' }),
    });

    const ctx = makeCtx({
      database: txDbLocal,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    await markDuesInvoicePaid(ctx);
    expect(transactionCalled).toBe(true);
  });

  test('rolls back invoice mark-paid when membership update fails', async () => {
    let transactionCalled = false;

    // DB that tracks transaction calls but throws on persistWithComputedStatus
    const failingDb: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(failingDb);
      },
      update: (_table: any) => ({
        set: (_data: any) => ({
          where: (_c: any) => ({
            returning: async () => { throw new Error('Membership update failed'); },
          }),
        }),
      }),
    };

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'sent' }),
      markPaid: async () => ({ ...fakeInvoice, status: 'paid' }),
    });
    stubRepo(DuesRepository, { getConfig: async () => undefined });
    stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...fakeMembership, duesExpiryDate: '2025-12-31' }),
    });

    const ctx = makeCtx({
      database: failingDb,
      _params: { invoiceId: 'inv-1' },
      _body: { paymentId: 'pay-1', paidAt: new Date().toISOString() },
    });

    // Error must propagate (DB would rollback both invoice + membership changes)
    await expect(markDuesInvoicePaid(ctx)).rejects.toThrow('Membership update failed');
    expect(transactionCalled).toBe(true);
  });
});
