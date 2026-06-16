// [EM-M06] Wave 26 — dues.payment.proof.rejected emission
import { describe, test, expect, afterEach, beforeEach, spyOn } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesPayment as createFakeDuesPayment } from '@/test-utils/factories';
import { rejectPaymentProof } from './rejectPaymentProof';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

const fakePayment = createFakeDuesPayment({
  id: 'pay-1',
  personId: 'person-1',
  organizationId: 'tenant-1',
  amount: 5000,
  status: 'submitted',
});

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

describe('rejectPaymentProof — dues.payment.proof.rejected', () => {
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
    officerMocks = stubOfficerAccess();
    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
  });

  afterEach(() => {
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
  });

  test('returns 200 and emits dues.payment.proof.rejected', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    const ctx = makeCtx({
      database: makeMockDb(),
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Blurry receipt' },
    });

    const res = await rejectPaymentProof(ctx);
    expect(res.status).toBe(200);

    const call = emitSpy.mock.calls.find((c) => c[0] === 'dues.payment.proof.rejected');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({
      paymentId: 'pay-1',
      personId: 'person-1',
      organizationId: 'tenant-1',
      reason: 'Blurry receipt',
    });
    emitSpy.mockRestore();
  });

  test('includes proof object when proofStorageKey present', async () => {
    restoreRepo(DuesRepository);
    stubRepo(DuesRepository, {
      getPayment: async () => ({
        ...fakePayment,
        proofStorageKey: 'key-1',
        proofFileName: 'receipt.png',
        proofMimeType: 'image/png',
        paidAt: new Date('2026-05-01T00:00:00Z'),
      }),
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    const ctx = makeCtx({
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Blurry' },
    });
    const res = await rejectPaymentProof(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.proof).toMatchObject({
      paymentId: 'pay-1',
      storageKey: 'key-1',
      fileName: 'receipt.png',
      mimeType: 'image/png',
    });
  });
});

describe('rejectPaymentProof — guard + state branches', () => {
  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesRepository);
  });

  test('returns 403 when caller lacks Treasurer/President position', async () => {
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    const ctx = makeCtx({ _params: { paymentId: 'pay-1' }, _body: { reason: 'x' } });
    const res = await rejectPaymentProof(ctx);
    expect(res.status).toBe(403);
  });

  test('throws NotFoundError when payment missing', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, { getPayment: async () => null });
    const ctx = makeCtx({ _params: { paymentId: 'pay-x' }, _body: { reason: 'x' } });
    await expect(rejectPaymentProof(ctx)).rejects.toThrow('DuesPayment');
  });

  test('throws BusinessLogicError when status is not submitted', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, status: 'verified' }),
    });
    const ctx = makeCtx({ _params: { paymentId: 'pay-1' }, _body: { reason: 'x' } });
    await expect(rejectPaymentProof(ctx)).rejects.toThrow("Cannot reject payment with status 'verified'");
  });

  test('throws BusinessLogicError on org mismatch', async () => {
    stubOfficerAccess();
    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, organizationId: 'other-org' }),
    });
    const ctx = makeCtx({ _params: { paymentId: 'pay-1' }, _body: { reason: 'x' } });
    await expect(rejectPaymentProof(ctx)).rejects.toThrow('Payment does not belong to this organization');
  });
});
