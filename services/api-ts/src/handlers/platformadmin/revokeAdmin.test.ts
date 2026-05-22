import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { revokeAdmin } from './revokeAdmin';
import { NotFoundError, BusinessLogicError } from '@/core/errors';

const existingAdmin = { id: 'admin-1', userId: 'u-1', email: 'a@example.com', name: 'Admin', role: 'support' };
const superAdmin = { ...existingAdmin, role: 'super' };

describe('revokeAdmin', () => {
  beforeEach(() => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, {
      findById: async () => existingAdmin,
      countByRole: async () => 2,
      delete: async () => {},
    });
  });

  afterEach(() => {
    restoreRepo(PlatformAdminRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { adminId: 'admin-1' } });
    const res = await revokeAdmin(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 204 when admin revoked', async () => {
    const ctx = makeCtx({ _params: { adminId: 'admin-1' } });
    const res = await revokeAdmin(ctx);
    expect(res.status).toBe(204);
  });

  test('throws NotFoundError when admin not found', async () => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, {
      findById: async () => undefined,
      countByRole: async () => 2,
      delete: async () => {},
    });
    const ctx = makeCtx({ _params: { adminId: 'nonexistent' } });
    await expect(revokeAdmin(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws BusinessLogicError when revoking last super admin', async () => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, {
      findById: async () => superAdmin,
      countByRole: async () => 1,
      delete: async () => {},
    });
    const ctx = makeCtx({ _params: { adminId: 'admin-1' } });
    await expect(revokeAdmin(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });

  test('allows revoking super when multiple supers exist', async () => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, {
      findById: async () => superAdmin,
      countByRole: async () => 2,
      delete: async () => {},
    });
    const ctx = makeCtx({ _params: { adminId: 'admin-1' } });
    const res = await revokeAdmin(ctx);
    expect(res.status).toBe(204);
  });
});
