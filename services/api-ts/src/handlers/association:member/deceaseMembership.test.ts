import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { deceaseMembership } from './deceaseMembership';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  personId: 'person-1',
  tierId: 'tier-1',
  removedAt: null,
  removalReason: null,
  dateOfDeath: null,
  startDate: '2025-01-01',
  duesExpiryDate: '2026-01-01',
});

/** Fake DB that supports transactions and raw drizzle-style update chains */
const makeInvoiceNoOp = () => ({
  set: () => ({ where: async () => [] }),
});

const txDb = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
  update: () => makeInvoiceNoOp(),
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
    const resignedMembership = { ...fakeMembership, status: 'resigned' };
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
    const deceasedMembership = { ...fakeMembership, status: 'deceased' };
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
    const removedMembership = { ...fakeMembership, status: 'removed' };
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
