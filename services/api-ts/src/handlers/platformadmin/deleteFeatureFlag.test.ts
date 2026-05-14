import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { deleteFeatureFlag } from './deleteFeatureFlag';
import { NotFoundError } from '@/core/errors';

const existingFlag = { id: 'flag-1', targetType: 'org', targetId: 'org-1', moduleName: 'billing', enabled: true };

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

  test('returns 204 on successful deletion', async () => {
    const ctx = makeCtx({ _params: { flagId: 'flag-1' } });
    const res = await deleteFeatureFlag(ctx);
    expect(res.status).toBe(204);
  });

  test('throws NotFoundError when flag not found', async () => {
    restoreRepo(FeatureFlagRepository);
    stubRepo(FeatureFlagRepository, {
      findById: async () => undefined,
      delete: async () => {},
    });
    const ctx = makeCtx({ _params: { flagId: 'nonexistent' } });
    await expect(deleteFeatureFlag(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
