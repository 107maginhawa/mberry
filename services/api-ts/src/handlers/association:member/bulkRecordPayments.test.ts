/**
 * Tests for bulkRecordPayments handler (Slice 044)
 *
 * Covers:
 * - Auth guards (401, 403 org context)
 * - Batch recording with multiple members
 * - Per-row validation (missing fields)
 * - Partial failure handling (some succeed, some fail)
 * - Max batch size enforcement
 * - Receipt number generation per row
 * - Transaction wrapping per payment
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues-payments.repo';
import { bulkRecordPayments } from './bulkRecordPayments';

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

const validBulkBody = {
  payments: [
    { personId: 'person-1', amount: 5000, paymentMethod: 'cash', referenceNumber: 'CASH-001' },
    { personId: 'person-2', amount: 3000, paymentMethod: 'gcash', referenceNumber: 'GC-002' },
    { personId: 'person-3', amount: 5000, paymentMethod: 'bank_deposit' },
  ],
};

function makeTestCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    organizationId: 'org-1',
    _body: validBulkBody,
    ...overrides,
  });
}

let paymentIdCounter = 0;

function defaultDuesStubs() {
  return stubRepo(DuesRepository, {
    findRecentPaymentForPerson: async () => undefined,
    getNextReceiptSequence: async () => ++paymentIdCounter,
    createPayment: async (data: any) => ({ ...basePayment, id: `pay-${paymentIdCounter}`, ...data }),
    updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({
      ...basePayment,
      ...extra,
    }),
    listFunds: async () => [],
    getConfig: async () => ({ billingFrequency: 'annual' }),
  });
}

function stubMembership() {
  // Inline dynamic import to avoid top-level import issues
  return import('@/handlers/association:member/repos/membership.repo').then(({ MembershipRepository }) => {
    restoreRepo(MembershipRepository);
    return stubRepo(MembershipRepository, {
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
  });
}

async function cleanupMembership() {
  const { MembershipRepository } = await import('@/handlers/association:member/repos/membership.repo');
  restoreRepo(MembershipRepository);
}

// ─── Tests ──────────────────────────────────────────────

describe('[044] bulkRecordPayments', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    paymentIdCounter = 0;
  });

  afterEach(async () => {
    restoreRepo(DuesRepository);
    await cleanupMembership();
  });

  // ── Auth Guards ──────────────────────────────────────

  test('returns 401 when no user', async () => {
    const ctx = makeTestCtx({ user: null, session: null });
    const res = await bulkRecordPayments(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when no organizationId', async () => {
    const ctx = makeTestCtx({ organizationId: null });
    const res = await bulkRecordPayments(ctx);
    expect(res.status).toBe(403);
  });

  // ── Input Validation ─────────────────────────────────

  test('returns 400 when payments array is empty', async () => {
    const ctx = makeTestCtx({ _body: { payments: [] } });
    const res = await bulkRecordPayments(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('must not be empty');
  });

  test('returns 400 when payments is missing', async () => {
    const ctx = makeTestCtx({ _body: {} });
    const res = await bulkRecordPayments(ctx);
    expect(res.status).toBe(400);
  });

  test('returns 400 when batch exceeds max size', async () => {
    const payments = Array.from({ length: 51 }, (_, i) => ({
      personId: `person-${i}`,
      amount: 1000,
      paymentMethod: 'cash',
    }));
    const ctx = makeTestCtx({ _body: { payments } });
    const res = await bulkRecordPayments(ctx);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('maximum');
  });

  // ── Per-Row Validation ────────────────────────────────

  test('rejects rows with missing personId', async () => {
    defaultDuesStubs();
    await stubMembership();

    const ctx = makeTestCtx({
      _body: {
        payments: [
          { amount: 5000, paymentMethod: 'cash' }, // missing personId
          { personId: 'person-2', amount: 3000, paymentMethod: 'gcash' },
        ],
      },
    });
    const res = await bulkRecordPayments(ctx);

    expect(res.body.results).toHaveLength(2);
    expect(res.body.results[0].status).toBe('error');
    expect(res.body.results[0].error).toContain('personId');
    expect(res.body.results[1].status).toBe('success');
    expect(res.body.summary.success).toBe(1);
    expect(res.body.summary.errors).toBe(1);
  });

  test('rejects rows with invalid amount', async () => {
    defaultDuesStubs();
    await stubMembership();

    const ctx = makeTestCtx({
      _body: {
        payments: [
          { personId: 'person-1', amount: 0, paymentMethod: 'cash' },
          { personId: 'person-2', amount: -100, paymentMethod: 'cash' },
        ],
      },
    });
    const res = await bulkRecordPayments(ctx);

    expect(res.body.results[0].status).toBe('error');
    expect(res.body.results[0].error).toContain('amount');
    expect(res.body.results[1].status).toBe('error');
    expect(res.body.summary.errors).toBe(2);
  });

  test('rejects rows with missing paymentMethod', async () => {
    defaultDuesStubs();
    await stubMembership();

    const ctx = makeTestCtx({
      _body: {
        payments: [
          { personId: 'person-1', amount: 5000 }, // missing paymentMethod
        ],
      },
    });
    const res = await bulkRecordPayments(ctx);

    expect(res.body.results[0].status).toBe('error');
    expect(res.body.results[0].error).toContain('paymentMethod');
  });

  // ── Happy Path ───────────────────────────────────────

  test('records multiple payments, returns 201 with per-row results', async () => {
    defaultDuesStubs();
    await stubMembership();

    const ctx = makeTestCtx();
    const res = await bulkRecordPayments(ctx);

    expect(res.status).toBe(201);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results.every((r: any) => r.status === 'success')).toBe(true);
    expect(res.body.summary.total).toBe(3);
    expect(res.body.summary.success).toBe(3);
    expect(res.body.summary.errors).toBe(0);
  });

  test('each payment gets a unique receipt number', async () => {
    defaultDuesStubs();
    await stubMembership();

    const ctx = makeTestCtx();
    const res = await bulkRecordPayments(ctx);

    const receiptNumbers = res.body.results.map((r: any) => r.receiptNumber);
    const uniqueReceipts = new Set(receiptNumbers);
    expect(uniqueReceipts.size).toBe(3);
  });

  // ── Partial Failure ──────────────────────────────────

  test('partial failure: valid rows succeed, invalid rows fail', async () => {
    defaultDuesStubs();
    await stubMembership();

    const ctx = makeTestCtx({
      _body: {
        payments: [
          { personId: 'person-1', amount: 5000, paymentMethod: 'cash' }, // valid
          { personId: '', amount: 0, paymentMethod: '' }, // all invalid
          { personId: 'person-3', amount: 3000, paymentMethod: 'gcash' }, // valid
        ],
      },
    });
    const res = await bulkRecordPayments(ctx);

    expect(res.status).toBe(201); // at least one success
    expect(res.body.summary.success).toBe(2);
    expect(res.body.summary.errors).toBe(1);
  });

  test('all rows fail returns 400', async () => {
    const ctx = makeTestCtx({
      _body: {
        payments: [
          { personId: '', amount: 0, paymentMethod: '' },
          { amount: -1 },
        ],
      },
    });
    const res = await bulkRecordPayments(ctx);

    expect(res.status).toBe(400);
    expect(res.body.summary.success).toBe(0);
  });

  // ── Default currency ─────────────────────────────────

  test('defaults to PHP currency when not specified', async () => {
    let capturedCurrency: string | undefined;

    stubRepo(DuesRepository, {
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => {
        capturedCurrency = data.currency;
        return { ...basePayment, ...data };
      },
      updatePaymentStatus: async () => basePayment,
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });
    await stubMembership();

    const ctx = makeTestCtx({
      _body: {
        payments: [{ personId: 'person-1', amount: 5000, paymentMethod: 'cash' }],
      },
    });
    await bulkRecordPayments(ctx);

    expect(capturedCurrency).toBe('PHP');
  });
});
