import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { denyMembershipApplication } from './denyMembershipApplication';
import { MembershipApplicationRepository } from './repos/membership.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const fakeApplication = {
  id: 'app-1',
  organizationId: 'tenant-1',
  orgId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'submitted',
  reviewedBy: null,
  reviewedAt: null,
  denialReason: null,
};

// ─── Tests ──────────────────────────────────────────────

describe('denyMembershipApplication', () => {
  let mocks: ReturnType<typeof stubRepo>;
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipApplicationRepository);
  });

  afterEach(() => {
    restoreRepo(OfficerTermRepository);
    restoreRepo(MembershipApplicationRepository);
  });

  test('denies a submitted application and returns 200', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => ({ ...fakeApplication, ...data }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { denialReason: 'Incomplete documentation' },
    });

    const response = await denyMembershipApplication(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('denied');
  });

  test('denies an underReview application and returns 200', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    const underReviewApp = { ...fakeApplication, status: 'underReview' };
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => underReviewApp,
      updateOneById: async (_id: string, data: any) => ({ ...underReviewApp, ...data }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { denialReason: 'Does not meet criteria' },
    });

    const response = await denyMembershipApplication(ctx);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('denied');
  });

  test('throws NotFoundError for non-existent application', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { applicationId: 'nonexistent' },
      _body: { denialReason: 'Not found' },
    });

    await expect(denyMembershipApplication(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when application is already approved', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...fakeApplication, status: 'approved' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { denialReason: 'Changed mind' },
    });

    await expect(denyMembershipApplication(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('throws BusinessLogicError when application is already denied', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => ({ ...fakeApplication, status: 'denied' }),
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { denialReason: 'Duplicate denial' },
    });

    await expect(denyMembershipApplication(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('returns 401 when no session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { applicationId: 'app-1' },
      _body: { denialReason: 'No auth' },
    });

    const res = await denyMembershipApplication(ctx);
    expect(res.status).toBe(401);
  });

  test('captures denialReason in the update', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { denialReason: 'Missing required license number' },
    });

    await denyMembershipApplication(ctx);
    expect(capturedUpdate.denialReason).toBe('Missing required license number');
    expect(capturedUpdate.status).toBe('denied');
  });

  test('stores null denialReason when not provided', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: {}, // no denialReason
    });

    await denyMembershipApplication(ctx);
    expect(capturedUpdate.denialReason).toBeNull();
  });

  test('sets reviewedBy to the session user id', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    let capturedUpdate: any = null;
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({
      user: { id: 'officer-42', role: 'officer', twoFactorEnabled: true },
      _params: { applicationId: 'app-1' },
      _body: { denialReason: 'Ineligible' },
    });

    await denyMembershipApplication(ctx);
    expect(capturedUpdate.reviewedBy).toBe('officer-42');
  });

  test('sets reviewedAt to current timestamp', async () => {
    officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
    let capturedUpdate: any = null;
    const before = new Date();
    mocks = stubRepo(MembershipApplicationRepository, {
      findOneById: async () => fakeApplication,
      updateOneById: async (_id: string, data: any) => { capturedUpdate = data; return { ...fakeApplication, ...data }; },
    });

    const ctx = makeCtx({
      _params: { applicationId: 'app-1' },
      _body: { denialReason: 'Test' },
    });

    await denyMembershipApplication(ctx);
    const after = new Date();
    expect(capturedUpdate.reviewedAt).toBeInstanceOf(Date);
    expect(capturedUpdate.reviewedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedUpdate.reviewedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  // ─── [BR] Invalid status transitions ─────────────────

  describe('invalid status transitions', () => {
    const nonDeniableStatuses = ['approved', 'denied', 'withdrawn'];

    for (const status of nonDeniableStatuses) {
      test(`throws BusinessLogicError for status '${status}'`, async () => {
        officerMocks = stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }] });
        mocks = stubRepo(MembershipApplicationRepository, {
          findOneById: async () => ({ ...fakeApplication, status }),
        });

        const ctx = makeCtx({
          _params: { applicationId: 'app-1' },
          _body: { denialReason: 'Test' },
        });

        await expect(denyMembershipApplication(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
      });
    }
  });
});
