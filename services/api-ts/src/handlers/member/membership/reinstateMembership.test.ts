import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { reinstateMembership } from './reinstateMembership';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────
//
// FIX-008 / decision #1: reinstate is LAPSED-ONLY.
//   - REMOVED / RESIGNED / DECEASED / EXPELLED are terminal + irreversible
//     (re-entry goes through re-application, not reinstate).
//   - SUSPENDED is restored via the dedicated unsuspend op, not reinstate.
//   - LAPSED is the only status reinstate accepts; it restores active standing
//     by extending the dues expiry.

const OLD_LAPSED_EXPIRY = '2020-01-01'; // far past grace → computes 'lapsed'

// A lapsed membership: no terminal/suspend flags, expiry long past grace.
const lapsedMembership = {
  id: 'mem-1',
  // Match the makeCtx() default org context so the FIX-003 cross-org guard
  // (record org must equal caller org) is satisfied for these same-org tests.
  organizationId: 'tenant-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'lapsed',
  removedAt: null,
  removalReason: null,
  suspendedAt: null,
  resignedAt: null,
  dateOfDeath: null,
  expelledAt: null,
  startDate: '2018-01-01',
  duesExpiryDate: OLD_LAPSED_EXPIRY,
  gracePeriodDays: 30,
};

// ─── Tests ──────────────────────────────────────────────

describe('reinstateMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  // ─── The one valid path: lapsed → active ───

  test('reinstates a lapsed membership and returns 200 with status active', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => lapsedMembership,
      updateOneById: async (_id: string, data: any) => ({ ...lapsedMembership, ...data }),
    });

    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });

    const response = await reinstateMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('active');
  });

  test('reinstatement pushes duesExpiryDate into the future (restores standing)', async () => {
    let captured: any = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => lapsedMembership,
      updateOneById: async (_id: string, data: any) => { captured = data; return { ...lapsedMembership, ...data }; },
    });

    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    const response = await reinstateMembership(ctx);

    expect(response.status).toBe(200);
    // The new expiry (written via persistWithComputedStatus or the response)
    // must be today or later so the computed status is 'active'.
    const newExpiry = response.body.duesExpiryDate ?? captured?.duesExpiryDate;
    expect(newExpiry).toBeDefined();
    const today = new Date().toISOString().split('T')[0];
    expect(newExpiry >= today).toBe(true);
  });

  // FIX-006 / G-08: reinstatement writes a status-history audit row
  test('writes a membership_status_history row on reinstate (FIX-006)', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => lapsedMembership,
      updateOneById: async (_id: string, data: any) => ({ ...lapsedMembership, ...data }),
    });

    const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
    await reinstateMembership(ctx);

    const inserts = (ctx.get('database') as any)._inserted as any[];
    expect(inserts.length).toBeGreaterThanOrEqual(1);
    const row = inserts[inserts.length - 1];
    expect(row.membershipId).toBe('mem-1');
    expect(row.personId).toBe('person-1');
    expect(row.fromStatus).toBe('lapsed');
    expect(row.toStatus).toBe('active');
    expect(row.changedBy).toBe('user-1');
  });

  // ─── Error guards ───

  test('throws NotFoundError for non-existent membership', async () => {
    mocks = stubRepo(MembershipRepository, { findOneById: async () => undefined });
    const ctx = makeCtx({ _params: { membershipId: 'nonexistent' } });
    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipRepository, { findOneById: async () => lapsedMembership });
    const ctx = makeCtx({ user: null, session: null, _params: { membershipId: 'mem-1' } });
    await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('scopes findOneById call to membershipId from route param', async () => {
    let capturedId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async (id: string) => { capturedId = id; return lapsedMembership; },
      updateOneById: async (_id: string, data: any) => ({ ...lapsedMembership, ...data }),
    });
    const ctx = makeCtx({ _params: { membershipId: 'mem-77' } });
    await reinstateMembership(ctx);
    expect(capturedId).toBe('mem-77');
  });

  // ─── [BR] Non-reinstatable statuses (terminal, suspended, in-standing) ───
  //
  // Each must reject. Terminal states are irreversible; suspended uses
  // unsuspend; active/grace/pending are already in standing.

  describe('rejects every non-lapsed status', () => {
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const recentPast = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const nonReinstatable: Array<[string, Record<string, any>]> = [
      ['removed (terminal)', { removedAt: new Date('2025-06-01'), status: 'removed' }],
      ['resigned (terminal)', { resignedAt: new Date('2025-06-01'), status: 'resigned' }],
      ['deceased (terminal)', { dateOfDeath: '2025-06-01', status: 'deceased' }],
      ['suspended (use unsuspend)', { suspendedAt: new Date('2025-05-01'), duesExpiryDate: future, status: 'suspended' }],
      ['active (in standing)', { duesExpiryDate: future, status: 'active' }],
      ['gracePeriod (in standing)', { duesExpiryDate: recentPast, status: 'gracePeriod' }],
      ['pendingPayment', { isPendingPayment: true, duesExpiryDate: null, status: 'pendingPayment' }],
    ];

    for (const [label, flags] of nonReinstatable) {
      test(`throws BusinessLogicError for ${label}`, async () => {
        mocks = stubRepo(MembershipRepository, {
          findOneById: async () => ({ ...lapsedMembership, ...flags }),
        });
        const ctx = makeCtx({ _params: { membershipId: 'mem-1' } });
        await expect(reinstateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      });
    }
  });
});
