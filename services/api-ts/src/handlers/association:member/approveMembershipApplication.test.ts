import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { approveMembershipApplication } from './approveMembershipApplication';
import { MembershipApplicationRepository, MembershipRepository } from './repos/membership.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeApplication = {
  id: 'app-1',
  tenantId: 'tenant-1',
  orgId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'submitted',
  reviewedBy: null,
  reviewedAt: null,
  denialReason: null,
};

const approvedApplication = {
  ...fakeApplication,
  status: 'approved',
  reviewedBy: 'user-1',
  reviewedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('approveMembershipApplication', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('approves a submitted application and returns 200', async () => {
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    // stubRepo returns one mock record, but approveMembershipApplication instantiates
    // two separate repo classes — patch MembershipRepository separately
    const membershipMocks = stubRepo(MembershipRepository, {
      createOne: async () => ({ id: 'mem-1' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    const response = await approveMembershipApplication(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');

    Object.values(membershipMocks).forEach((m) => m.mockRestore());
  });

  test('approves an underReview application and returns 200', async () => {
    const underReviewApp = { ...fakeApplication, status: 'underReview' };
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => underReviewApp,
      updateOneById: async (_id: string, data: any) => ({ ...underReviewApp, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      createOne: async () => ({ id: 'mem-2' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    const response = await approveMembershipApplication(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');

    Object.values(membershipMocks).forEach((m) => m.mockRestore());
  });

  test('throws NotFoundError for non-existent application', async () => {
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { applicationId: 'nonexistent' },
    });

    await expect(approveMembershipApplication(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when application is already approved', async () => {
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...fakeApplication, status: 'approved' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    await expect(approveMembershipApplication(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when application is denied', async () => {
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...fakeApplication, status: 'denied' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    await expect(approveMembershipApplication(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws UnauthorizedError when no session', async () => {
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { applicationId: 'app-1' },
    });

    await expect(approveMembershipApplication(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('sets reviewedBy to the session user id', async () => {
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeApplication, ...data }; },
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      createOne: async () => ({ id: 'mem-1' }),
    });

    const ctx = makeCtx({
      user: { id: 'reviewer-99', role: 'officer' },
      _params: { applicationId: 'app-1' },
    });

    await approveMembershipApplication(ctx);
    expect(capturedUpdate.reviewedBy).toBe('reviewer-99');
    expect(capturedUpdate.status).toBe('approved');

    Object.values(membershipMocks).forEach((m) => m.mockRestore());
  });

  test('sets reviewedAt to current timestamp', async () => {
    let capturedUpdate: any = null;
    const before = new Date();
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeApplication, ...data }; },
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      createOne: async () => ({ id: 'mem-1' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    await approveMembershipApplication(ctx);
    const after = new Date();
    expect(capturedUpdate.reviewedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.reviewedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedUpdate.reviewedAt.getTime()).toBeLessThanOrEqual(after.getTime());

    Object.values(membershipMocks).forEach((m) => m.mockRestore());
  });

  test('creates membership record with 1-year expiry from approval date', async () => {
    let capturedMembership: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      createOne: async (data: any) => { capturedMembership = data; return { id: 'mem-1' }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    const before = new Date();
    await approveMembershipApplication(ctx);
    const after = new Date();

    expect(capturedMembership).not.toBeNull();

    // startDate should be today's date in YYYY-MM-DD format
    const todayStr = before.toISOString().split('T')[0];
    expect(capturedMembership.startDate).toBe(todayStr);

    // duesExpiryDate should be exactly 1 year from today
    const expectedExpiryDate = new Date(before);
    expectedExpiryDate.setFullYear(expectedExpiryDate.getFullYear() + 1);
    const expectedExpiryStr = expectedExpiryDate.toISOString().split('T')[0];
    expect(capturedMembership.duesExpiryDate).toBe(expectedExpiryStr);

    Object.values(membershipMocks).forEach((m) => m.mockRestore());
  });

  test('creates membership with pendingPayment status', async () => {
    let capturedMembership: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });
    const membershipMocks = stubRepo(MembershipRepository, {
      createOne: async (data: any) => { capturedMembership = data; return { id: 'mem-1' }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
    });

    await approveMembershipApplication(ctx);
    expect(capturedMembership.status).toBe('pendingPayment');
    expect(capturedMembership.personId).toBe('person-1');
    expect(capturedMembership.orgId).toBe('org-1');
    expect(capturedMembership.tierId).toBe('tier-1');

    Object.values(membershipMocks).forEach((m) => m.mockRestore());
  });
});
