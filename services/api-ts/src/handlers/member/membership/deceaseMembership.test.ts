import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { deceaseMembership } from './deceaseMembership';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

// ─── Fixtures ───────────────────────────────────────────

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  // Match the makeCtx() default org context so the FIX-003 cross-org guard
  // (record org must equal caller org) is satisfied for these same-org tests.
  organizationId: 'tenant-1',
  personId: 'person-1',
  tierId: 'tier-1',
  removedAt: null,
  removalReason: null,
  dateOfDeath: null,
  startDate: '2025-01-01',
  duesExpiryDate: FUTURE_EXPIRY,
});

/** Fake DB that supports transactions and raw drizzle-style update chains */
const makeUpdateChain = (rows: any[] = []) => ({
  set: (_d: any) => makeUpdateChain(rows),
  where: (_c: any) => makeUpdateChain(rows),
  returning: async () => rows,
});

const txDb: any = {
  _inserted: [] as any[],
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
  update: (_table: any) => makeUpdateChain(),
  insert: (_table: any) => ({ values: async (vals: any) => { txDb._inserted.push(vals); } }),
};

// ─── Tests ──────────────────────────────────────────────

describe('deceaseMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  // Test 1: returns 200 with status='deceased' and dateOfDeath stored
  test('returns 200 with status=deceased when officer marks member deceased', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    const response = await deceaseMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('deceased');
  });

  // Test: emits membership.status.changed for cross-module visibility (EM-M05-evt-deceased)
  test('emits membership.status.changed with newStatus=deceased', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    const emitted: Array<{ e: string; p: any }> = [];
    const origEmit = domainEvents.emit.bind(domainEvents);
    (domainEvents as any).emit = async (e: string, p: any) => { emitted.push({ e, p }); };
    try {
      const ctx = makeCtx({
        database: txDb,
        _params: { membershipId: 'mem-1' },
        _body: { dateOfDeath: '2026-01-15' },
      });
      await deceaseMembership(ctx);

      const evt = emitted.find((x) => x.e === 'membership.status.changed');
      expect(evt).toBeDefined();
      expect(evt!.p.newStatus).toBe('deceased');
      expect(evt!.p.membershipId).toBe('mem-1');
      expect(evt!.p.personId).toBe('person-1');
      // Event carries the membership's org (fixture aligned to ctx org for FIX-003).
      expect(evt!.p.organizationId).toBe('tenant-1');
    } finally {
      (domainEvents as any).emit = origEmit;
    }
  });

  // Test (FIX-006 / G-08): writes a membership_status_history row
  test('writes a membership_status_history row on decease (FIX-006)', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    txDb._inserted = [];
    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    await deceaseMembership(ctx);

    expect(txDb._inserted.length).toBeGreaterThanOrEqual(1);
    const row = txDb._inserted[txDb._inserted.length - 1];
    expect(row.membershipId).toBe('mem-1');
    expect(row.personId).toBe('person-1');
    expect(row.fromStatus).toBe('active');
    expect(row.toStatus).toBe('deceased');
    expect(row.changedBy).toBe('user-1');
  });

  // Test 2: throws NotFoundError for non-existent membershipId
  test('throws NotFoundError for non-existent membershipId', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'nonexistent' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    await expect(deceaseMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  // Test 3: throws UnauthorizedError when no session
  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    await expect(deceaseMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  // Test 4: throws BusinessLogicError when membership already in terminal state
  test('throws BusinessLogicError when membership already resigned', async () => {
    const resignedMembership = { ...fakeMembership, resignedAt: new Date('2025-01-01'), removedAt: null, suspendedAt: null };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => resignedMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    await expect(deceaseMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership already deceased', async () => {
    const deceasedMembership = { ...fakeMembership, dateOfDeath: '2025-01-01', removedAt: null, suspendedAt: null };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => deceasedMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    await expect(deceaseMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership already removed', async () => {
    const removedMembership = { ...fakeMembership, removedAt: new Date('2025-01-01'), suspendedAt: null };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => removedMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    await expect(deceaseMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // Test 5: stores dateOfDeath from request body
  test('stores dateOfDeath from request body', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakeMembership, ...data };
      },
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    await deceaseMembership(ctx);
    expect(capturedUpdate.dateOfDeath).toBe('2026-01-15');
    expect(capturedUpdate.status).toBe('deceased');
  });

  // Test 6: captures removalReason when provided
  test('captures removalReason when provided', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakeMembership, ...data };
      },
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15', terminationReason: 'Passed away' },
    });

    await deceaseMembership(ctx);
    expect(capturedUpdate.removalReason).toBe('Passed away');
  });

  // Test 7: sets removedAt to current timestamp
  test('sets removedAt to current timestamp', async () => {
    let capturedUpdate: any = null;
    const before = new Date();
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => {
        capturedUpdate = data;
        return { ...fakeMembership, ...data };
      },
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { dateOfDeath: '2026-01-15' },
    });

    await deceaseMembership(ctx);
    const after = new Date();
    expect(capturedUpdate.removedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.removedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedUpdate.removedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  // Test 8: marks deceased from any non-terminal status
  describe('marks deceased from any non-terminal status', () => {
    const resolvableStatuses = ['active', 'suspended', 'gracePeriod', 'lapsed', 'expired'];

    for (const status of resolvableStatuses) {
      test(`marks deceased for membership with status '${status}'`, async () => {
        const memberWithStatus = { ...fakeMembership, status };
        let capturedStatus: string | null = null;
        mocks = stubRepo(MembershipRepository, {
          findOneById: async () => memberWithStatus,
          updateOneById: async (_id: string, data: any) => {
            capturedStatus = data.status;
            return { ...memberWithStatus, ...data };
          },
        });

        const ctx = makeCtx({
          database: txDb,
          _params: { membershipId: 'mem-1' },
          _body: { dateOfDeath: '2026-01-15' },
        });

        const response = await deceaseMembership(ctx);
        expect(response.status).toBe(200);
        expect(capturedStatus).toBe('deceased');
      });
    }
  });
});
