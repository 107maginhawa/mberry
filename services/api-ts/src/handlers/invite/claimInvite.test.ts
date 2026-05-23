import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeInvite as createFakeInvite } from '@/test-utils/factories';
import { claimInvite } from './claimInvite';
import { InviteRepository } from './repos/invite.repo';
import { MembershipRepository } from '../membership/repos/membership.repo';
import { hashToken } from './utils/token';

// ─── Fixtures ───────────────────────────────────────────

const TEST_SECRET = 'dev-secret-change-in-production';
const RAW_TOKEN = 'valid-raw-token-abc123';
const TOKEN_HASH = hashToken(RAW_TOKEN, TEST_SECRET);

const fakePendingInvite = createFakeInvite({
  tokenHash: TOKEN_HASH,
  type: 'invite',
  email: 'member@example.com',
  personId: null,
  message: null,
  metadata: { role: 'member' },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdByOfficer: 'officer-1',
  claimedAt: null,
  updatedAt: new Date(),
});

const fakeClaimedInvite = {
  ...fakePendingInvite,
  status: 'claimed',
  claimedAt: new Date(),
};

const fakeMembership = {
  id: 'membership-1',
  organizationId: 'org-1',
  personId: 'user-1',
  tierId: null,
  categoryId: null,
  memberNumber: null,
  startDate: '2026-05-23',
  duesExpiryDate: '2027-05-23',
  gracePeriodDays: 30,
  status: 'active',
  joinedAt: new Date(),
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Helper to stub both repos with default happy-path mocks
function stubBothRepos(
  inviteOverrides: Record<string, any> = {},
  membershipOverrides: Record<string, any> = {},
) {
  const inviteMocks = stubRepo(InviteRepository, {
    findByTokenHash: async () => fakePendingInvite,
    markClaimed: async () => fakeClaimedInvite,
    ...inviteOverrides,
  });

  const membershipMocks = stubRepo(MembershipRepository, {
    getMember: async () => null, // no existing membership
    addMember: async (data: any) => ({ ...fakeMembership, ...data }),
    ...membershipOverrides,
  });

  return { inviteMocks, membershipMocks };
}

// ─── Tests ──────────────────────────────────────────────

describe('claimInvite', () => {
  let mocks: ReturnType<typeof stubBothRepos>;

  afterEach(() => {
    if (mocks) {
      Object.values(mocks.inviteMocks).forEach((m) => m.mockRestore());
      Object.values(mocks.membershipMocks).forEach((m) => m.mockRestore());
    }
  });

  test('claims valid invite and creates membership — returns 200 with orgId, metadata, membershipStatus, membershipId', async () => {
    mocks = stubBothRepos();

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const response = await claimInvite(ctx);
    expect(response.body.claimed).toBe(true);
    expect(response.body.organizationId).toBe('org-1');
    expect(response.body.metadata).toEqual({ role: 'member' });
    expect(response.body.membershipStatus).toBe('joined');
    expect(response.body.membershipId).toBeDefined();
  });

  test('returns 401 when no user in session', async () => {
    mocks = stubBothRepos();

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { token: RAW_TOKEN },
    });

    const response = await claimInvite(ctx);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
  });

  test('returns 400 when token param is missing', async () => {
    mocks = stubBothRepos();

    const ctx = makeCtx({
      _params: {}, // no token
    });

    const response = await claimInvite(ctx);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Token is required');
  });

  test('throws NotFoundError when token hash does not match any invite', async () => {
    mocks = stubBothRepos({
      findByTokenHash: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { token: 'invalid-raw-token-xyz' },
    });

    const { NotFoundError } = await import('@/core/errors');
    await expect(claimInvite(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ConflictError when invite is already claimed', async () => {
    mocks = stubBothRepos({
      findByTokenHash: async () => ({ ...fakePendingInvite, status: 'claimed' }),
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const { ConflictError } = await import('@/core/errors');
    await expect(claimInvite(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws BusinessLogicError with INVITE_REVOKED code when invite is revoked', async () => {
    mocks = stubBothRepos({
      findByTokenHash: async () => ({ ...fakePendingInvite, status: 'revoked' }),
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(claimInvite(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    try {
      await claimInvite(ctx);
    } catch (e: any) {
      expect(e.code).toBe('INVITE_REVOKED');
    }
  });

  test('throws BusinessLogicError with INVITE_EXPIRED code when invite is expired', async () => {
    mocks = stubBothRepos({
      findByTokenHash: async () => ({
        ...fakePendingInvite,
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      }),
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const { BusinessLogicError } = await import('@/core/errors');
    await expect(claimInvite(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    try {
      await claimInvite(ctx);
    } catch (e: any) {
      expect(e.code).toBe('INVITE_EXPIRED');
    }
  });

  test('calls markClaimed with the correct invite id', async () => {
    let capturedId: string | null = null;
    mocks = stubBothRepos({
      findByTokenHash: async () => fakePendingInvite,
      markClaimed: async (id: string) => {
        capturedId = id;
        return fakeClaimedInvite;
      },
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    await claimInvite(ctx);
    expect(capturedId).toBe('invite-1');
  });

  test('returns null metadata when invite has no metadata', async () => {
    mocks = stubBothRepos({
      findByTokenHash: async () => ({ ...fakePendingInvite, metadata: null }),
      markClaimed: async () => ({ ...fakeClaimedInvite, metadata: null }),
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const response = await claimInvite(ctx);
    expect(response.body.claimed).toBe(true);
    expect(response.body.metadata).toBeNull();
    expect(response.body.membershipStatus).toBe('joined');
  });

  // ─── Membership-specific tests ────────────────────────

  test('throws ConflictError when user is already a member of the organization', async () => {
    mocks = stubBothRepos({}, {
      getMember: async () => ({ membership: fakeMembership, person: null, category: null }),
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const { ConflictError } = await import('@/core/errors');
    await expect(claimInvite(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('uses invite metadata tierId and categoryId when provided', async () => {
    let capturedMemberData: any = null;

    mocks = stubBothRepos({
      findByTokenHash: async () => ({
        ...fakePendingInvite,
        metadata: {
          membershipTierId: 'tier-99',
          membershipCategoryId: 'cat-77',
          licenseNumber: 'LIC-123',
        },
      }),
    }, {
      getMember: async () => null,
      addMember: async (data: any) => {
        capturedMemberData = data;
        return { ...fakeMembership, ...data, id: 'membership-2' };
      },
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const response = await claimInvite(ctx);
    expect(response.body.membershipStatus).toBe('joined');
    expect(capturedMemberData.tierId).toBe('tier-99');
    expect(capturedMemberData.categoryId).toBe('cat-77');
    expect(capturedMemberData.memberNumber).toBe('LIC-123');
  });

  test('creates membership with default null tierId when metadata has no tier', async () => {
    let capturedMemberData: any = null;

    mocks = stubBothRepos({
      findByTokenHash: async () => ({
        ...fakePendingInvite,
        metadata: { role: 'member' }, // no tier/category
      }),
    }, {
      getMember: async () => null,
      addMember: async (data: any) => {
        capturedMemberData = data;
        return { ...fakeMembership, ...data, id: 'membership-3' };
      },
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    await claimInvite(ctx);
    expect(capturedMemberData.tierId).toBeNull();
    expect(capturedMemberData.categoryId).toBeNull();
    expect(capturedMemberData.memberNumber).toBeNull();
  });

  test('membership addMember is called with correct personId from user context', async () => {
    let capturedMemberData: any = null;

    mocks = stubBothRepos({}, {
      getMember: async () => null,
      addMember: async (data: any) => {
        capturedMemberData = data;
        return { ...fakeMembership, ...data, id: 'membership-4' };
      },
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    await claimInvite(ctx);
    expect(capturedMemberData.personId).toBe('user-1');
    expect(capturedMemberData.organizationId).toBe('org-1');
    expect(capturedMemberData.status).toBe('active');
    expect(capturedMemberData.createdBy).toBe('user-1');
    expect(capturedMemberData.updatedBy).toBe('user-1');
  });
});
