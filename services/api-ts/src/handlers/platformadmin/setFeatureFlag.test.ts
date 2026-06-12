import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeFeatureFlag } from '@/test-utils/factories';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { setFeatureFlag } from './setFeatureFlag';
import { domainEvents } from '@/core/domain-events';

const fakeFlag = fakeFeatureFlag();
const SUPER_ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

describe('setFeatureFlag', () => {
  beforeEach(() => {
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, { upsert: async () => fakeFlag });
  });

  afterEach(() => {
    restoreRepo(FeatureFlagRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true } });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(401);
  });

  // ─── FIX-001 (G1): super-only platform mutation ──────────────────────
  // Matrix §3.7: feature flags = super only. analyst/support must be rejected.
  test('returns 403 for analyst platform admin (not super)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'analyst' },
      _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true },
    });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 for support platform admin (not super)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'support' },
      _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true },
    });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 when platformAdmin context is absent', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      platformAdmin: undefined,
      _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true },
    });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 with upserted flag', async () => {
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true } });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.moduleName).toBe('billing');
    expect((res as any).body?.enabled).toBe(true);
  });

  test('can disable a feature flag', async () => {
    const disabledFlag = { ...fakeFlag, enabled: false };
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, { upsert: async () => disabledFlag });
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: false } });
    const res = await setFeatureFlag(ctx);
    expect((res as any).body?.enabled).toBe(false);
  });

  // AC-M03-002: disable warning
  test('returns warning when disabling a feature flag', async () => {
    const disabledFlag = { ...fakeFlag, enabled: false };
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, { upsert: async () => disabledFlag });
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: false } });
    const res = await setFeatureFlag(ctx);
    expect((res as any).body?.warning).toContain('Disabling');
    expect((res as any).body?.warning).toContain('billing');
    expect((res as any).body?.warning).toContain('immediately');
  });

  test('does not return warning when enabling a feature flag', async () => {
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true } });
    const res = await setFeatureFlag(ctx);
    expect((res as any).body?.warning).toBeUndefined();
  });

  // [EM-M03-f5a6b7c8] WF-018: authentication module must be always-on
  test('rejects disabling the authentication module (BusinessLogicError)', async () => {
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'authentication', enabled: false } });
    await expect(setFeatureFlag(ctx)).rejects.toMatchObject({ statusCode: expect.any(Number) });
  });

  test('allows enabling the authentication module', async () => {
    const enabledAuth = { ...fakeFlag, moduleName: 'authentication', enabled: true };
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, { upsert: async () => enabledAuth });
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'authentication', enabled: true } });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(200);
  });

  // [EM-M03-d1e2f3a4]
  test('emits feature_flag.changed', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true } });
    await setFeatureFlag(ctx);
    const call = emitSpy.mock.calls.find((c) => c[0] === 'feature_flag.changed');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({ targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true });
    emitSpy.mockRestore();
  });
});
