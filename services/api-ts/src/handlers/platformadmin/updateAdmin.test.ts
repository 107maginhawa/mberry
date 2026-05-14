import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { updateAdmin } from './updateAdmin';
import { NotFoundError } from '@/core/errors';

const existingAdmin = { id: 'admin-1', userId: 'u-1', email: 'a@example.com', name: 'Admin', role: 'support' };
const updatedAdmin = { ...existingAdmin, role: 'analyst' };

describe('updateAdmin', () => {
  beforeEach(() => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, {
      findById: async () => existingAdmin,
      update: async () => updatedAdmin,
    });
  });

  afterEach(() => {
    restoreRepo(PlatformAdminRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { adminId: 'admin-1' }, _body: {} });
    const res = await updateAdmin(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with updated admin', async () => {
    const ctx = makeCtx({ _params: { adminId: 'admin-1' }, _body: { role: 'analyst' } });
    const res = await updateAdmin(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.role).toBe('analyst');
  });

  test('throws NotFoundError when admin not found', async () => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, {
      findById: async () => undefined,
      update: async () => updatedAdmin,
    });
    const ctx = makeCtx({ _params: { adminId: 'nonexistent' }, _body: {} });
    await expect(updateAdmin(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });
});
