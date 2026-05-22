import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeFeatureFlag } from '@/test-utils/factories';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { setFeatureFlag } from './setFeatureFlag';

const fakeFlag = fakeFeatureFlag();

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

  test('returns 200 with upserted flag', async () => {
    const ctx = makeCtx({ _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true } });
    const res = await setFeatureFlag(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.moduleName).toBe('billing');
    expect((res as any).body?.enabled).toBe(true);
  });

  test('can disable a feature flag', async () => {
    const disabledFlag = { ...fakeFlag, enabled: false };
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, { upsert: async () => disabledFlag });
    const ctx = makeCtx({ _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: false } });
    const res = await setFeatureFlag(ctx);
    expect((res as any).body?.enabled).toBe(false);
  });

  // AC-M03-002: disable warning
  test('returns warning when disabling a feature flag', async () => {
    const disabledFlag = { ...fakeFlag, enabled: false };
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, { upsert: async () => disabledFlag });
    const ctx = makeCtx({ _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: false } });
    const res = await setFeatureFlag(ctx);
    expect((res as any).body?.warning).toContain('Disabling');
    expect((res as any).body?.warning).toContain('billing');
    expect((res as any).body?.warning).toContain('immediately');
  });

  test('does not return warning when enabling a feature flag', async () => {
    const ctx = makeCtx({ _body: { targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true } });
    const res = await setFeatureFlag(ctx);
    expect((res as any).body?.warning).toBeUndefined();
  });
});
