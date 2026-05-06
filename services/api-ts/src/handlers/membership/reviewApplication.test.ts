import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { reviewApplication } from './reviewApplication';
import { MembershipRepository } from './repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeApplication = {
  id: 'app-1',
  organizationId: 'org-1',
  orgId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'submitted',
  reviewedBy: null,
  reviewedAt: null,
  denialReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeMember = {
  id: 'mem-1',
  organizationId: 'org-1',
  orgId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  status: 'active',
};

// ─── Tests ──────────────────────────────────────────────

describe('reviewApplication [BR-03]', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('approves application and creates membership', async () => {
    let addMemberCalled = false;
    mocks = stubRepo(MembershipRepository, {
      reviewApplication: async () => ({ ...fakeApplication, status: 'approved', reviewedBy: 'user-1' }),
      addMember: async (data: any) => { addMemberCalled = true; return { ...fakeMember, ...data }; },
    });

    const ctx = makeCtx({
      _params: { appId: 'app-1' },
      _body: { status: 'approved' },
    });

    const response = await reviewApplication(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('approved');
    expect(addMemberCalled).toBe(true);
  });

  test('denies application without creating membership', async () => {
    let addMemberCalled = false;
    mocks = stubRepo(MembershipRepository, {
      reviewApplication: async () => ({ ...fakeApplication, status: 'denied', reviewedBy: 'user-1' }),
      addMember: async () => { addMemberCalled = true; return fakeMember; },
    });

    const ctx = makeCtx({
      _params: { appId: 'app-1' },
      _body: { status: 'rejected', reason: 'Incomplete documents' },
    });

    const response = await reviewApplication(ctx);
    expect(response.status).toBe(200);
    // 'rejected' is mapped to 'denied'
    expect(addMemberCalled).toBe(false);
  });

  test('maps "pending" status to "submitted"', async () => {
    let capturedStatus: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      reviewApplication: async (_id: string, status: string) => {
        capturedStatus = status;
        return { ...fakeApplication, status };
      },
      addMember: async () => fakeMember,
    });

    const ctx = makeCtx({
      _params: { appId: 'app-1' },
      _body: { status: 'pending' },
    });

    await reviewApplication(ctx);
    expect(capturedStatus).toBe('submitted');
  });

  test('maps "rejected" status to "denied"', async () => {
    let capturedStatus: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      reviewApplication: async (_id: string, status: string) => {
        capturedStatus = status;
        return { ...fakeApplication, status };
      },
      addMember: async () => fakeMember,
    });

    const ctx = makeCtx({
      _params: { appId: 'app-1' },
      _body: { status: 'rejected' },
    });

    await reviewApplication(ctx);
    expect(capturedStatus).toBe('denied');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(MembershipRepository, {
      reviewApplication: async () => fakeApplication,
      addMember: async () => fakeMember,
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { appId: 'app-1' },
      _body: { status: 'approved' },
    });

    await expect(reviewApplication(ctx)).rejects.toThrow();
  });

  test('passes reviewer id from session to repo', async () => {
    let capturedReviewerId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      reviewApplication: async (_id: string, _status: string, reviewerId: string) => {
        capturedReviewerId = reviewerId;
        return { ...fakeApplication, status: 'denied', reviewedBy: reviewerId };
      },
      addMember: async () => fakeMember,
    });

    const ctx = makeCtx({
      user: { id: 'reviewer-7', role: 'officer' },
      _params: { appId: 'app-1' },
      _body: { status: 'denied', reason: 'Not eligible' },
    });

    await reviewApplication(ctx);
    expect(capturedReviewerId).toBe('reviewer-7');
  });

  test('uses appId from route param', async () => {
    let capturedId: string | null = null;
    mocks = stubRepo(MembershipRepository, {
      reviewApplication: async (id: string) => {
        capturedId = id;
        return { ...fakeApplication, status: 'approved' };
      },
      addMember: async () => fakeMember,
    });

    const ctx = makeCtx({
      _params: { appId: 'app-42' },
      _body: { status: 'approved' },
    });

    await reviewApplication(ctx);
    expect(capturedId).toBe('app-42');
  });
});
