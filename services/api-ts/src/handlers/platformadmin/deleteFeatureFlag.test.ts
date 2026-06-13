import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { deleteFeatureFlag } from './deleteFeatureFlag';
import { NotFoundError } from '@/core/errors';

const existingFlag = { id: 'flag-1', targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true };
const SUPER_ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

describe('deleteFeatureFlag', () => {
  beforeEach(() => {
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, {
      findById: async () => existingFlag,
      delete: async () => {},
    });
  });

  afterEach(() => {
    restoreRepo(FeatureFlagRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { flagId: 'flag-1' } });
    const res = await deleteFeatureFlag(ctx);
    expect(res.status).toBe(401);
  });

  // ─── FIX-001 (G1): super-only platform mutation ──────────────────────
  // Matrix §3.7: feature flags = super only. analyst/support must be rejected.
  test('returns 403 for analyst platform admin (not super)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'analyst' },
      _params: { flagId: 'flag-1' },
    });
    const res = await deleteFeatureFlag(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 for support platform admin (not super)', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'support' },
      _params: { flagId: 'flag-1' },
    });
    const res = await deleteFeatureFlag(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 403 when platformAdmin context is absent', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      platformAdmin: undefined,
      _params: { flagId: 'flag-1' },
    });
    const res = await deleteFeatureFlag(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 204 on successful deletion', async () => {
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _params: { flagId: 'flag-1' } });
    const res = await deleteFeatureFlag(ctx);
    expect(res.status).toBe(204);
  });

  test('throws NotFoundError when flag not found', async () => {
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, {
      findById: async () => undefined,
      delete: async () => {},
    });
    const ctx = makeCtx({ platformAdmin: SUPER_ADMIN, _params: { flagId: 'nonexistent' } });
    await expect(deleteFeatureFlag(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
