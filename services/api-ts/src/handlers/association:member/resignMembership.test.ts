import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { resignMembership } from './resignMembership';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeMembership = {
  id: 'mem-1',
  organizationId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'active',
  terminatedAt: null,
  terminationReason: null,
  dateOfDeath: null,
  startDate: '2025-01-01',
  duesExpiryDate: '2026-01-01',
};

/** Fake DB that supports transactions and raw drizzle-style update chains */
const makeInvoiceNoOp = () => ({
  set: () => ({ where: async () => [] }),
});

const txDb = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
  update: () => makeInvoiceNoOp(),
};

// ─── Tests ──────────────────────────────────────────────

describe('resignMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  // Test 1: happy path — returns 200 with status='resigned' for active member
  test('returns 200 with status=resigned when officer resigns active member', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: { terminationReason: 'Voluntary resignation' },
    });

    const response = await resignMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('resigned');
  });

  // Test 2: throws NotFoundError for non-existent membershipId
  test('throws NotFoundError for non-existent membershipId', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'nonexistent' },
      _body: {},
    });

    await expect(resignMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
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
      _body: {},
    });

    await expect(resignMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
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
      _body: {},
    });

    await expect(resignMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership already deceased', async () => {
    const deceasedMembership = { ...fakeMembership, status: 'deceased' };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => deceasedMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: {},
    });

    await expect(resignMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership already expelled', async () => {
    const expelledMembership = { ...fakeMembership, status: 'expelled' };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => expelledMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: {},
    });

    await expect(resignMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when membership already terminated', async () => {
    const terminatedMembership = { ...fakeMembership, status: 'terminated' };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => terminatedMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { membershipId: 'mem-1' },
      _body: {},
    });

    await expect(resignMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // Test 5: captures terminationReason in update when provided
  test('captures terminationReason in update when provided', async () => {
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
      _body: { terminationReason: 'Relocating abroad' },
    });

    await resignMembership(ctx);
    expect(capturedUpdate.terminationReason).toBe('Relocating abroad');
    expect(capturedUpdate.status).toBe('resigned');
  });

  // Test 6: stores null terminationReason when not provided (optional field)
  test('stores null terminationReason when not provided', async () => {
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
      _body: {}, // no terminationReason
    });

    await resignMembership(ctx);
    expect(capturedUpdate.terminationReason).toBeNull();
  });

  // Test 7: sets terminatedAt to current timestamp
  test('sets terminatedAt to current timestamp', async () => {
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
      _body: {},
    });

    await resignMembership(ctx);
    const after = new Date();
    expect(capturedUpdate.terminatedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.terminatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedUpdate.terminatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  // Test 8: resigns memberships from any non-terminal status
  describe('resigns memberships with any non-terminal status', () => {
    const resolvableStatuses = ['active', 'suspended', 'gracePeriod', 'lapsed', 'expired'];

    for (const status of resolvableStatuses) {
      test(`resigns membership with status '${status}'`, async () => {
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
          _body: {},
        });

        const response = await resignMembership(ctx);
        expect(response.status).toBe(200);
        expect(capturedStatus).toBe('resigned');
      });
    }
  });
});
