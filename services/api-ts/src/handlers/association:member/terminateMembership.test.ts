import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { terminateMembership } from './terminateMembership';
import { MembershipRepository } from './repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  organizationId: 'tenant-1',
  personId: 'person-1',
  tierId: 'tier-1',
  removedAt: null,
  terminationReason: null,
  startDate: '2025-01-01',
  duesExpiryDate: FUTURE_EXPIRY,
});

// ─── Tests ──────────────────────────────────────────────

describe('terminateMembership', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('terminates an active membership and returns 200', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
      _body: { terminationReason: 'Non-payment of dues' },
    });

    const response = await terminateMembership(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('removed');
  });

  test('throws NotFoundError for non-existent membership', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { membershipId: 'nonexistent' },
      _body: { terminationReason: 'Test' },
    });

    await expect(terminateMembership(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { membershipId: 'mem-1' },
      _body: { terminationReason: 'Test' },
    });

    await expect(terminateMembership(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('captures terminationReason in the update', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeMembership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
      _body: { terminationReason: 'Voluntary resignation' },
    });

    await terminateMembership(ctx);
    expect(capturedUpdate.removalReason).toBe('Voluntary resignation');
    expect(capturedUpdate.status).toBe('removed');
  });

  test('stores null terminationReason when not provided', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeMembership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
      _body: {}, // no terminationReason
    });

    await terminateMembership(ctx);
    expect(capturedUpdate.removalReason).toBeNull();
  });

  test('sets removedAt to current timestamp', async () => {
    let capturedUpdate: any = null;
    const before = new Date();
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => fakeMembership,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeMembership, ...data }; },
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
      _body: { terminationReason: 'Disciplinary action' },
    });

    await terminateMembership(ctx);
    const after = new Date();
    expect(capturedUpdate.removedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.removedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedUpdate.removedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('scopes findOneById call to membershipId from route param', async () => {
    let capturedId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      findOneById: async (id: string) => { capturedId = id; return fakeMembership; },
      updateOneById: async (_id: string, data: any) => ({ ...fakeMembership, ...data }),
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-99' },
      _body: { terminationReason: 'Test' },
    });

    await terminateMembership(ctx);
    expect(capturedId).toBe('mem-99');
  });

  // ─── [BR-03] Status guard: cannot terminate pending memberships ──

  test('[BR-03] throws BusinessLogicError when terminating pendingPayment membership', async () => {
    const pendingMembership = { ...fakeMembership, isPendingPayment: true, duesExpiryDate: null, suspendedAt: null, removedAt: null };
    mocks = stubRepo(MembershipRepository, {
      findOneById: async () => pendingMembership,
    });

    const ctx = makeCtx({
      _params: { membershipId: 'mem-1' },
      _body: { terminationReason: 'Test' },
    });

    await expect(terminateMembership(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  // ─── Terminatable statuses (all except pendingPayment) ──

  describe('terminates memberships with valid statuses', () => {
    const terminatableStatuses = ['active', 'suspended', 'gracePeriod', 'lapsed', 'expired'];

    for (const status of terminatableStatuses) {
      test(`terminates membership with status '${status}'`, async () => {
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
          _params: { membershipId: 'mem-1' },
          _body: { terminationReason: 'Test reason' },
        });

        const response = await terminateMembership(ctx);
        expect(response.status).toBe(200);
        expect(capturedStatus).toBe('removed');
      });
    }
  });
});
