import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeInvite as createFakeInvite } from '@/test-utils/factories';
import { InviteRepository } from './repos/invite.repo';
import { validateInvite } from './validateInvite';

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

const fakeInvite = createFakeInvite({
  email: 'member@pda.org',
  type: 'member',
  tokenHash: 'hashed-token',
  expiresAt: futureDate,
  metadata: { firstName: 'Alice' },
});

function makeCtxForInvite(overrides: Record<string, any> = {}) {
  const ctx = makeCtx(overrides) as any;
  // validateInvite uses ctx.json(body) without status for 200 responses
  ctx.json = (body: any, status: number = 200) => ({ status, body });
  return ctx;
}

describe('validateInvite (public endpoint)', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns 400 when token is missing', async () => {
    const ctx = makeCtxForInvite({
      user: null,
      session: null,
      _params: { token: '' },
    });

    // makeCtx returns '' for missing params, handler checks for falsy token
    const res = await validateInvite(ctx as any);
    expect(res.status).toBe(400);
  });

  test('returns 404 when invite not found', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => undefined,
    });

    const ctx = makeCtxForInvite({
      user: null,
      session: null,
      _params: { token: 'invalid-token' },
    });

    const res = await validateInvite(ctx as any);
    expect(res.status).toBe(404);
  });

  test('returns 410 when invite is already claimed', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => ({ ...fakeInvite, status: 'claimed' }),
    });

    const ctx = makeCtxForInvite({
      _params: { token: 'valid-token' },
    });

    const res = await validateInvite(ctx as any);
    expect(res.status).toBe(410);
    expect((res as any).body.code).toBe('ALREADY_CLAIMED');
  });

  test('returns 410 when invite is revoked', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => ({ ...fakeInvite, status: 'revoked' }),
    });

    const ctx = makeCtxForInvite({
      _params: { token: 'valid-token' },
    });

    const res = await validateInvite(ctx as any);
    expect(res.status).toBe(410);
    expect((res as any).body.code).toBe('REVOKED');
  });

  test('returns 410 when invite is expired', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => ({ ...fakeInvite, expiresAt: pastDate }),
    });

    const ctx = makeCtxForInvite({
      _params: { token: 'valid-token' },
    });

    const res = await validateInvite(ctx as any);
    expect(res.status).toBe(410);
    expect((res as any).body.code).toBe('EXPIRED');
  });

  test('returns 200 with pre-populated data for valid invite', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => fakeInvite,
    });

    const ctx = makeCtxForInvite({
      user: null,
      session: null,
      _params: { token: 'valid-token' },
    });

    const res = await validateInvite(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.valid).toBe(true);
    expect((res as any).body.email).toBe('member@pda.org');
    expect((res as any).body.orgId).toBe('org-1');
    expect((res as any).body.type).toBe('member');
  });

  test('is a public endpoint — works without auth', async () => {
    mocks = stubRepo(InviteRepository, {
      findByTokenHash: async () => fakeInvite,
    });

    // No user or session
    const ctx = makeCtxForInvite({
      user: null,
      session: null,
      _params: { token: 'valid-token' },
    });

    const res = await validateInvite(ctx as any);
    expect(res.status).toBe(200);
  });
});
