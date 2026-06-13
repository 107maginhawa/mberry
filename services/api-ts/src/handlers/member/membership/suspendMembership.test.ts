import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { suspendMembership } from './suspendMembership';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────
//
// FIX-009 / decision #1: suspend is a dedicated reversible officer action
// (paired with unsuspend). It is NOT reinstate.

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const activeMembership = {
  id: 'mem-1',
  organizationId: 'tenant-1', // matches makeCtx default org (FIX-003 guard)
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'active',
  removedAt: null,
  removalReason: null,
  suspendedAt: null,
  resignedAt: null,
  dateOfDeath: null,
  expelledAt: null,
  startDate: '2025-01-01',
  duesExpiryDate: FUTURE_EXPIRY,
  gracePeriodDays: 30,
};

describe('suspendMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('suspends an active membership and returns 200 with status suspended', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => activeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...activeMembership, ...data }),
    });
    const ctx = makeCtx({ _params: { membershipId: 'mem-1' }, _body: { reason: 'Pending dues review' } });
    const response = await suspendMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('suspended');
  });

  test('suspends a lapsed membership', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => ({ ...activeMembership, duesExpiryDate: '2020-01-01' }),
      updateOneById: async (_id: string, data: any) => ({ ...activeMembership, ...data }),
    });
    const ctx = makeCtx({ _params: { membershipId: 'mem-1' }, _body: {} });
    const response = await suspendMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('suspended');
  });

  test('throws NotFoundError for non-existent membership', async () => {
    mocks = stubRepo(MembershipRepository, { findOneById: async () => undefined });
    const ctx = makeCtx({ _params: { membershipId: 'nope' }, _body: {} });
    await expect(suspendMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipRepository, { findOneById: async () => activeMembership });
    const ctx = makeCtx({ user: null, session: null, _params: { membershipId: 'mem-1' }, _body: {} });
    await expect(suspendMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  describe('rejects non-suspendable statuses', () => {
    const cases: Array<[string, Record<string, any>]> = [
      ['already suspended', { suspendedAt: new Date('2025-05-01') }],
      ['removed (terminal)', { removedAt: new Date('2025-06-01') }],
      ['resigned (terminal)', { resignedAt: new Date('2025-06-01') }],
      ['deceased (terminal)', { dateOfDeath: '2025-06-01' }],
      ['pendingPayment', { isPendingPayment: true, duesExpiryDate: null }],
    ];
    for (const [label, flags] of cases) {
      test(`throws BusinessLogicError for ${label}`, async () => {
        mocks = stubRepo(MembershipRepository, { findOneById: async () => ({ ...activeMembership, ...flags }) });
        const ctx = makeCtx({ _params: { membershipId: 'mem-1' }, _body: {} });
        await expect(suspendMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      });
    }
  });
});
