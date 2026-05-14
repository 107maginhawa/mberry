import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { listFeatureFlags } from './listFeatureFlags';

const fakeFlags = [
  { id: 'flag-1', targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true },
  { id: 'flag-2', targetType: 'org', targetId: 'org-1', moduleName: 'events', enabled: false },
];

describe('listFeatureFlags', () => {
  beforeEach(() => {
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, { findByTarget: async () => fakeFlags });
  });

  afterEach(() => {
    restoreRepo(FeatureFlagRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _query: {} });
    const res = await listFeatureFlags(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with feature flags', async () => {
    const ctx = makeCtx({ _query: { targetType: 'org', targetId: 'org-1' } });
    const res = await listFeatureFlags(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toHaveLength(2);
  });

  test('returns empty array when no flags for target', async () => {
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, { findByTarget: async () => [] });
    const ctx = makeCtx({ _query: { targetType: 'org', targetId: 'org-2' } });
    const res = await listFeatureFlags(ctx);
    expect((res as any).body).toHaveLength(0);
  });
});
