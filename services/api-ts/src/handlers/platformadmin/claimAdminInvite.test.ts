/**
 * claimAdminInvite — FIX-003 (G4) invite-claim flow.
 *
 * inviteAdmin creates a platform_admin row with a placeholder userId, so the
 * invitee can never pass platformAdminAuthMiddleware (findByUserId). This claim
 * handler binds the invited row to the invitee's REAL Better-Auth userId,
 * keyed on the authenticated (verified) email, so they gain admin access.
 */
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { claimAdminInvite } from './claimAdminInvite';
import { domainEvents } from '@/core/domain-events';

const INVITED = { id: 'pa-9', userId: 'placeholder-uuid', email: 'new@example.com', name: 'New Admin', role: 'support' };

describe('claimAdminInvite', () => {
  beforeEach(() => {
    restoreRepo(PlatformAdminRepository);
  });
  afterEach(() => {
    restoreRepo(PlatformAdminRepository);
  });

  test('returns 401 without an authenticated user', async () => {
    const ctx = makeCtx({ user: null, session: null });
    const res = await claimAdminInvite(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 404 when no admin invitation matches the authenticated email', async () => {
    stubRepo(PlatformAdminRepository, { findByEmail: async () => null });
    const ctx = makeCtx({ user: { id: 'u-real', email: 'nobody@example.com', emailVerified: true } });
    const res = await claimAdminInvite(ctx);
    expect(res.status).toBe(404);
  });

  test('binds the invited admin row to the real Better-Auth userId on claim', async () => {
    let updatedId: string | undefined;
    let updatedData: any;
    stubRepo(PlatformAdminRepository, {
      findByEmail: async () => ({ ...INVITED }),
      update: async (id: string, data: any) => { updatedId = id; updatedData = data; return { ...INVITED, ...data }; },
    });
    // Mixed-case email proves the handler normalizes before matching.
    const ctx = makeCtx({ user: { id: 'u-real', email: 'New@Example.com', emailVerified: true } });
    const res = await claimAdminInvite(ctx);
    expect(res.status).toBe(200);
    expect(updatedId).toBe('pa-9');
    expect(updatedData).toMatchObject({ userId: 'u-real' });
    expect((res as any).body?.claimed).toBe(true);
  });

  test('is idempotent — re-claiming by the already-bound user does not rebind', async () => {
    let updateCalled = false;
    stubRepo(PlatformAdminRepository, {
      findByEmail: async () => ({ ...INVITED, userId: 'u-real' }),
      update: async () => { updateCalled = true; return { ...INVITED }; },
    });
    const ctx = makeCtx({ user: { id: 'u-real', email: 'new@example.com', emailVerified: true } });
    const res = await claimAdminInvite(ctx);
    expect(res.status).toBe(200);
    expect(updateCalled).toBe(false);
  });

  test('rejects an unverified email (privilege escalation guard)', async () => {
    stubRepo(PlatformAdminRepository, { findByEmail: async () => ({ ...INVITED }) });
    const ctx = makeCtx({ user: { id: 'u-real', email: 'new@example.com', emailVerified: false } });
    const res = await claimAdminInvite(ctx);
    expect(res.status).toBe(403);
  });

  test('emits admin.invite.claimed on a successful bind', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    try {
      stubRepo(PlatformAdminRepository, {
        findByEmail: async () => ({ ...INVITED }),
        update: async (_id: string, data: any) => ({ ...INVITED, ...data }),
      });
      const ctx = makeCtx({ user: { id: 'u-real', email: 'new@example.com', emailVerified: true } });
      await claimAdminInvite(ctx);
      const call = emitSpy.mock.calls.find((c) => c[0] === 'admin.invite.claimed');
      expect(call).toBeDefined();
      expect(call?.[1]).toMatchObject({ adminId: 'pa-9', userId: 'u-real', email: 'new@example.com', role: 'support' });
    } finally {
      emitSpy.mockRestore();
    }
  });
});
