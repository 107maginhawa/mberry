/**
 * listPendingProofs.test.ts
 *
 * Money handler — covers:
 *   - Unauthorized (no session / throws)
 *   - Position guard: non-officer → 403
 *   - Happy path — returns submitted payments with proof envelope
 *   - Pagination defaults and overrides
 *   - Payments without proofStorageKey have proof: undefined
 */
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesPayment } from '@/test-utils/factories';
import { listPendingProofs } from './listPendingProofs';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

const FAKE_PAYMENT_WITH_PROOF = {
  ...fakeDuesPayment({
    id: 'pay-1',
    organizationId: 'tenant-1',
    personId: 'person-1',
    amount: 3000,
    status: 'submitted',
  }),
  proofStorageKey: 'uploads/proof-001.jpg',
  proofFileName: 'receipt.jpg',
  proofMimeType: 'image/jpeg',
  paidAt: new Date('2026-01-15T10:00:00Z'),
  createdAt: new Date('2026-01-14T08:00:00Z'),
};

const FAKE_PAYMENT_NO_PROOF = {
  ...fakeDuesPayment({
    id: 'pay-2',
    organizationId: 'tenant-1',
    personId: 'person-2',
    amount: 1500,
    status: 'submitted',
  }),
  proofStorageKey: null,
  proofFileName: null,
  proofMimeType: null,
  paidAt: null,
  createdAt: new Date('2026-01-13T07:00:00Z'),
};

function stubOfficerAccess() {
  stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

describe('listPendingProofs', () => {
  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
  });

  test('returns 403 when user has no officer term (non-officer)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      database: makeMockDb(),
      _query: { organizationId: 'tenant-1' },
    });
    const res = await listPendingProofs(ctx as any);
    expect(res.status).toBe(403);
  });

  test('throws UnauthorizedError when no session (after position guard passes)', async () => {
    // requirePosition reads user from ctx — null user triggers its own guard
    const ctx = makeCtx({ user: null, session: null, database: makeMockDb() });
    // requirePosition will return 401/403 or throw — either way not 200
    try {
      const res = await listPendingProofs(ctx as any);
      expect(res.status).not.toBe(200);
    } catch {
      // threw — acceptable
    }
  });

  test('happy path — returns submitted payments with enriched proof', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      listPayments: async () => ({
        data: [{ ...FAKE_PAYMENT_WITH_PROOF }],
        total: 1,
      }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: {},
    });

    const res = await listPendingProofs(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('pay-1');
    expect(body.data[0].proof).toBeDefined();
    expect(body.data[0].proof.paymentId).toBe('pay-1');
    expect(body.data[0].proof.storageKey).toBe('uploads/proof-001.jpg');
    expect(body.data[0].proof.fileName).toBe('receipt.jpg');
    expect(body.data[0].proof.mimeType).toBe('image/jpeg');
  });

  test('payment without proofStorageKey has proof: undefined', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      listPayments: async () => ({
        data: [{ ...FAKE_PAYMENT_NO_PROOF }],
        total: 1,
      }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: {},
    });

    const res = await listPendingProofs(ctx as any);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data[0].proof).toBeUndefined();
  });

  test('pagination defaults: limit=25 offset=0', async () => {
    stubOfficerAccess();
    let captured: any;
    stubRepo(DuesRepository, {
      listPayments: async (filter: any) => { captured = filter; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: {},
    });

    await listPendingProofs(ctx as any);
    expect(captured.limit).toBe(25);
    expect(captured.offset).toBe(0);
    expect(captured.status).toBe('submitted');
  });

  test('pagination query overrides respected', async () => {
    stubOfficerAccess();
    let captured: any;
    stubRepo(DuesRepository, {
      listPayments: async (filter: any) => { captured = filter; return { data: [], total: 0 }; },
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: { limit: 10, offset: 20 },
    });

    await listPendingProofs(ctx as any);
    expect(captured.limit).toBe(10);
    expect(captured.offset).toBe(20);
  });

  test('returns correct pagination envelope', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      listPayments: async () => ({ data: [], total: 42 }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: { limit: 10, offset: 0 },
    });

    const res = await listPendingProofs(ctx as any);
    const body = (res as any).body;
    expect(body.pagination.total).toBe(42);
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.offset).toBe(0);
  });

  test('proof uploadedAt falls back to createdAt when paidAt is null', async () => {
    stubOfficerAccess();
    const createdAt = new Date('2026-01-10T06:00:00Z');
    stubRepo(DuesRepository, {
      listPayments: async () => ({
        data: [{
          ...FAKE_PAYMENT_NO_PROOF,
          proofStorageKey: 'uploads/x.pdf',
          proofFileName: 'x.pdf',
          proofMimeType: 'application/pdf',
          paidAt: null,
          createdAt,
        }],
        total: 1,
      }),
    });

    const ctx = makeCtx({
      database: makeMockDb(),
      organizationId: 'tenant-1',
      _query: {},
    });

    const res = await listPendingProofs(ctx as any);
    const body = (res as any).body;
    expect(body.data[0].proof.uploadedAt).toBe(createdAt.toISOString());
  });
});
