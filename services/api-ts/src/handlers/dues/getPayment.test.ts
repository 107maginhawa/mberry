import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getPayment } from './getPayment';
import { DuesRepository } from './repos/dues.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePayment = {
  id: 'pay-1',
  organizationId: 'org-1',
  personId: 'person-1',
  receiptNumber: 'ORG-2025-000001',
  amount: 5000,
  currency: 'PHP',
  paymentMethod: 'cash',
  status: 'completed',
  refundedAmount: 0,
};

const fakeAllocations = [
  { id: 'alloc-1', paymentId: 'pay-1', fundId: 'fund-1', amount: 3000, isReversal: false },
  { id: 'alloc-2', paymentId: 'pay-1', fundId: 'fund-2', amount: 2000, isReversal: false },
];

// ─── Tests ──────────────────────────────────────────────

describe('getPayment', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let memberMocks: ReturnType<typeof stubRepo>;

  const stubMembership = () => stubRepo(MembershipRepository, {
    getMember: async () => ({ id: 'mem-1', personId: 'user-1', orgId: 'org-1', status: 'active' }),
  });

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
    if (memberMocks) Object.values(memberMocks).forEach((m) => m.mockRestore());
  });

  test('returns payment with fund allocations and 200', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => fakeAllocations,
    });

    const ctx = makeCtx({ _params: { id: 'pay-1' } });
    const response = await getPayment(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('pay-1');
    expect(response.body.data.fundAllocations).toHaveLength(2);
  });

  test('throws NotFoundError for non-existent payment', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'pay-nonexistent' } });
    await expect(getPayment(ctx)).rejects.toThrow('Payment not found');
  });

  test('crashes without session (org ownership requires session)', async () => {
    memberMocks = stubMembership();
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => [],
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'pay-1' },
    });

    // session.user.id is accessed for org ownership check
    await expect(getPayment(ctx)).rejects.toThrow();
  });
});
