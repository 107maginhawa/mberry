import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { reinstateMembership } from './reinstateMembership';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const terminatedMembership = {
  id: 'mem-1',
  tenantId: 'tenant-1',
  orgId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'terminated',
  terminatedAt: new Date('2025-06-01'),
  terminationReason: 'Non-payment',
  startDate: '2025-01-01',
  duesExpiryDate: '2026-01-01',
};

const suspendedMembership = {
  ...terminatedMembership,
  status: 'suspended',
  terminatedAt: null,
  terminationReason: null,
};

// ─── Tests ──────────────────────────────────────────────

describe('reinstateMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('reinstates a terminated membership and returns 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => terminatedMembership,
      updateOneById: async (_id: string, data: any) => ({ ...terminatedMembership, ...data }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    const response = await reinstateMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('active');
  });

  test('reinstates a suspended membership and returns 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => suspendedMembership,
      updateOneById: async (_id: string, data: any) => ({ ...suspendedMembership, ...data }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    const response = await reinstateMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('active');
  });

  test('throws NotFoundError for non-existent membership', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { membershipId: 'nonexistent' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => terminatedMembership,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { membershipId: 'mem-1' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws BusinessLogicError when membership is already active', async () => {
    const activeMembership = { ...terminatedMembership, status: 'active', terminatedAt: null, terminationReason: null };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => activeMembership,
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership is in grace status', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...terminatedMembership, status: 'grace' }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership is lapsed', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...terminatedMembership, status: 'lapsed' }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('clears terminatedAt and terminationReason on reinstatement', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => terminatedMembership,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...terminatedMembership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    await reinstateMembership(ctx);
    expect(capturedUpdate.terminatedAt).toBeNull();
    expect(capturedUpdate.terminationReason).toBeNull();
    expect(capturedUpdate.status).toBe('active');
  });

  test('scopes findOneById call to membershipId from route param', async () => {
    let capturedId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async (id: string) => { capturedId = id; return terminatedMembership; },
      updateOneById: async (_id: string, data: any) => ({ ...terminatedMembership, ...data }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-77' },
    });

    await reinstateMembership(ctx);
    expect(capturedId).toBe('mem-77');
  });

  // ─── [BR] Valid reinstatement paths ───────────────────

  describe('valid reinstatement statuses', () => {
    const reinstatableStatuses = ['terminated', 'suspended'];

    for (const status of reinstatableStatuses) {
      test(`${status} → active succeeds`, async () => {
        const memberWithStatus = { ...terminatedMembership, status };
        let capturedStatus: string | null = null;
        mocks = stubRepo(MembershipRepository, {
          findOneById: async () => memberWithStatus,
          updateOneById: async (_id: string, data: any) => {
            capturedStatus = data.status;
            return { ...memberWithStatus, ...data };
          },
        });

        const ctx = makeCtx({
          _params: { membershipId: 'mem-1' },
        });

        const response = await reinstateMembership(ctx);
        expect(response.status).toBe(200);
        expect(capturedStatus).toBe('active');
      });
    }
  });

  // ─── [BR] Invalid reinstatement statuses ─────────────

  describe('invalid reinstatement statuses', () => {
    const nonReinstatableStatuses = ['active', 'pending', 'grace', 'lapsed', 'pendingPayment'];

    for (const status of nonReinstatableStatuses) {
      test(`throws BusinessLogicError for status '${status}'`, async () => {
        mocks = stubRepo(MembershipRepository, {
          findOneById: async () => ({ ...terminatedMembership, status }),
        });

        const ctx = makeCtx({
          _params: { membershipId: 'mem-1' },
        });

        await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      });
    }
  });
});
