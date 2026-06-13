import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { unsuspendMembership } from './unsuspendMembership';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────
//
// FIX-009 / decision #1: unsuspend is the ONLY way out of suspended (reinstate
// no longer accepts suspended). Clearing suspendedAt restores the computed
// standing (active / gracePeriod / lapsed) from the dues expiry.

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const suspendedMembership = {
  id: 'mem-1',
  organizationId: 'tenant-1', // matches makeCtx default org (FIX-003 guard)
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'suspended',
  removedAt: null,
  removalReason: null,
  suspendedAt: new Date('2025-05-01'),
  resignedAt: null,
  dateOfDeath: null,
  expelledAt: null,
  startDate: '2025-01-01',
  duesExpiryDate: FUTURE_EXPIRY,
  gracePeriodDays: 30,
};

describe('unsuspendMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('unsuspends a suspended membership and returns to active standing', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => suspendedMembership,
      updateOneById: async (_id: string, data: any) => ({ ...suspendedMembership, ...data }),
    });
    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    const response = await unsuspendMembership(ctx);
    expect(response.status).toBe(200);
    // future expiry → computed status is active once the suspension is lifted
    expect(response.body.status).toBe('active');
  });

  test('unsuspending a member whose dues lapsed returns them to lapsed', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...suspendedMembership, duesExpiryDate: '2020-01-01' }),
      updateOneById: async (_id: string, data: any) => ({ ...suspendedMembership, ...data }),
    });
    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    const response = await unsuspendMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('lapsed');
  });

  test('throws NotFoundError for non-existent membership', async () => {
    mocks = stubRepo(MembershipRepository, { findOneById: async () => undefined });
    const ctx = makeCtx({ _params: { membershipId: 'nope' } });
    await expect(unsuspendMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipRepository, { findOneById: async () => suspendedMembership });
    const ctx = makeCtx({ user: null, session: null, _params: { membershipId: 'mem-1' } });
    await expect(unsuspendMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  describe('rejects memberships that are not suspended', () => {
    const cases: Array<[string, Record<string, any>]> = [
      ['active', { suspendedAt: null, duesExpiryDate: FUTURE_EXPIRY }],
      ['lapsed', { suspendedAt: null, duesExpiryDate: '2020-01-01' }],
      ['removed (terminal)', { suspendedAt: null, removedAt: new Date('2025-06-01') }],
      ['resigned (terminal)', { suspendedAt: null, resignedAt: new Date('2025-06-01') }],
    ];
    for (const [label, flags] of cases) {
      test(`throws BusinessLogicError for ${label}`, async () => {
        mocks = stubRepo(MembershipRepository, { findOneById: async () => ({ ...suspendedMembership, ...flags }) });
        const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
        await expect(unsuspendMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      });
    }
  });
});
