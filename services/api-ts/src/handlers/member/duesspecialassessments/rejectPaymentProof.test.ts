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
});
