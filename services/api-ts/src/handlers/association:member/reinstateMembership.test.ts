import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { reinstateMembership } from './reinstateMembership';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const removedMembership = {
  id: 'mem-1',
  organizationId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'removed',
  removedAt: new Date('2025-06-01'),
  removalReason: 'Non-payment',
  startDate: '2025-01-01',
  duesExpiryDate: FUTURE_EXPIRY,
  suspendedAt: null,
  dateOfDeath: null,
  expelledAt: null,
  resignedAt: null,
  gracePeriodDays: 30,
};

const suspendedMembership = {
  ...removedMembership,
  status: 'suspended',
  removedAt: null,
  removalReason: null,
  suspendedAt: new Date('2025-05-01'),
  dateOfDeath: null,
  expelledAt: null,
  resignedAt: null,
  gracePeriodDays: 30,
};

// ─── Tests ──────────────────────────────────────────────

describe('reinstateMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('reinstates a removed membership and returns 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => removedMembership,
      updateOneById: async (_id: string, data: any) => ({ ...removedMembership, ...data }),
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
      findOneById: async () => removedMembership,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { membershipId: 'mem-1' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws BusinessLogicError when membership is already active', async () => {
    const activeMembership = { ...removedMembership, status: 'active', removedAt: null, removalReason: null, suspendedAt: null };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => activeMembership,
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership is in grace status', async () => {
    // gracePeriod: expiry in recent past (within 30-day grace window), no flags set
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...removedMembership, removedAt: null, duesExpiryDate: yesterday }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership is lapsed', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...removedMembership, removedAt: null, duesExpiryDate: '2020-01-01' }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('clears removedAt and removalReason on reinstatement', async () => {
    let capturedRemovalReason: any = 'NOT_CALLED';
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => removedMembership,
      updateOneById: async (_id: string, data: any) => {
        // Handler calls updateOneById to clear removalReason after persistWithComputedStatus
        capturedRemovalReason = data.removalReason;
        return { ...removedMembership, ...data };
      },
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
    });

    const response = await reinstateMembership(ctx);
    // persistWithComputedStatus sets suspendedAt/removedAt to null + status=active in DB
    expect(response.body.status).toBe('active');
    // updateOneById also called to clear removalReason
    expect(capturedRemovalReason).toBeNull();
  });

  test('scopes findOneById call to membershipId from route param', async () => {
    let capturedId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async (id: string) => { capturedId = id; return removedMembership; },
      updateOneById: async (_id: string, data: any) => ({ ...removedMembership, ...data }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-77' },
    });

    await reinstateMembership(ctx);
    expect(capturedId).toBe('mem-77');
  });

  // ─── [BR] Valid reinstatement paths ───────────────────

  describe('valid reinstatement statuses', () => {
    // Flag-field overrides that produce each reinstatable computed status
    const reinstatableFixtures: Array<[string, Record<string, any>]> = [
      ['removed', { removedAt: new Date('2025-06-01'), suspendedAt: null }],
      ['suspended', { suspendedAt: new Date('2025-05-01'), removedAt: null }],
    ];

    for (const [status, flags] of reinstatableFixtures) {
      test(`${status} → active succeeds`, async () => {
        const memberWithStatus = { ...removedMembership, ...flags };
        mocks = stubRepo(MembershipRepository, {
          findOneById: async () => memberWithStatus,
          updateOneById: async (_id: string, data: any) => ({ ...memberWithStatus, ...data }),
        });

        const ctx = makeCtx({
          _params: { membershipId: 'mem-1' },
        });

        const response = await reinstateMembership(ctx);
        expect(response.status).toBe(200);
        // persistWithComputedStatus writes status to DB directly; verify via response body
        expect(response.body.status).toBe('active');
      });
    }
  });

  // ─── [BR] Invalid reinstatement statuses ─────────────

  describe('invalid reinstatement statuses', () => {
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    // Flag-field overrides that produce each non-reinstatable computed status
    const nonReinstatableFixtures: Array<[string, Record<string, any>]> = [
      ['active', { removedAt: null, suspendedAt: null, duesExpiryDate: '2099-01-01' }],
      ['pending', { removedAt: null, suspendedAt: null, isPendingPayment: true, duesExpiryDate: null }],
      ['grace', { removedAt: null, suspendedAt: null, duesExpiryDate: yesterday }],
      ['lapsed', { removedAt: null, suspendedAt: null, duesExpiryDate: '2020-01-01' }],
      ['pendingPayment', { removedAt: null, suspendedAt: null, isPendingPayment: true, duesExpiryDate: null }],
    ];

    for (const [status, flags] of nonReinstatableFixtures) {
      test(`throws BusinessLogicError for status '${status}'`, async () => {
        mocks = stubRepo(MembershipRepository, {
          findOneById: async () => ({ ...removedMembership, ...flags }),
        });

        const ctx = makeCtx({
          _params: { membershipId: 'mem-1' },
        });

        await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      });
    }
  });
});
