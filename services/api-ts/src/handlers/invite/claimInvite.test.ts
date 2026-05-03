import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { claimInvite } from './claimInvite';
import { InviteRepository } from './repos/invite.repo';
import { hashToken } from './utils/token';

// ─── Fixtures ───────────────────────────────────────────

const TEST_SECRET = 'dev-secret-change-in-production';
const RAW_TOKEN = 'valid-raw-token-abc123';
const TOKEN_HASH = hashToken(RAW_TOKEN, TEST_SECRET);

const fakePendingInvite = {
  id: 'invite-1',
  orgId: 'org-1',
  personId: null,
  tokenHash: TOKEN_HASH,
  type: 'invite',
  status: 'pending',
  email: 'member@example.com',
  message: null,
  metadata: { role: 'member' },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  createdByOfficer: 'officer-1',
  claimedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeClaimedInvite = {
  ...fakePendingInvite,
  status: 'claimed',
  claimedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('claimInvite', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('claims valid invite and returns 200 with orgId and metadata', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => fakePendingInvite,
      markClaimed: async () => fakeClaimedInvite,
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const response = await claimInvite(ctx);
    // Handler calls ctx.json(body) with no status — mock returns undefined status.
    expect(response.body.claimed).toBe(true);
    expect(response.body.orgId).toBe('org-1');
    expect(response.body.metadata).toEqual({ role: 'member' });
  });

  test('returns 401 when no user in session', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => fakePendingInvite,
      markClaimed: async () => fakeClaimedInvite,
    });

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
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => fakePendingInvite,
      markClaimed: async () => fakeClaimedInvite,
    });

    const ctx = makeCtx({
      _params: {}, // no token
    });

    const response = await claimInvite(ctx);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Token is required');
  });

  test('throws NotFoundError when token hash does not match any invite', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => undefined,
      markClaimed: async () => fakeClaimedInvite,
    });

    const ctx = makeCtx({
      _params: { token: 'invalid-raw-token-xyz' },
    });

    const { NotFoundError } = await import('@/core/errors');
    await expect(claimInvite(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ConflictError when invite is already claimed', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => ({ ...fakePendingInvite, status: 'claimed' }),
      markClaimed: async () => fakeClaimedInvite,
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const { ConflictError } = await import('@/core/errors');
    await expect(claimInvite(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  test('throws BusinessLogicError with INVITE_REVOKED code when invite is revoked', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => ({ ...fakePendingInvite, status: 'revoked' }),
      markClaimed: async () => fakeClaimedInvite,
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
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => ({
        ...fakePendingInvite,
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
      }),
      markClaimed: async () => fakeClaimedInvite,
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
    mocks = stubRepo(InviteRepository, {
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
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => ({ ...fakePendingInvite, metadata: null }),
      markClaimed: async () => ({ ...fakeClaimedInvite, metadata: null }),
    });

    const ctx = makeCtx({
      _params: { token: RAW_TOKEN },
    });

    const response = await claimInvite(ctx);
    expect(response.body.claimed).toBe(true);
    expect(response.body.metadata).toBeNull();
  });
});
