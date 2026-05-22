import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakePlatformAdmin } from '@/test-utils/factories';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { listAdmins } from './listAdmins';

const fakeAdmins = [
  fakePlatformAdmin({ email: 'a@example.com' }),
  fakePlatformAdmin({ id: 'admin-2', email: 'b@example.com', name: 'Support', role: 'support' }),
];

describe('listAdmins', () => {
  beforeEach(() => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, { findAll: async () => fakeAdmins });
  });

  afterEach(() => {
    restoreRepo(PlatformAdminRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null });
    const res = await listAdmins(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with admin list', async () => {
    const ctx = makeCtx();
    const res = await listAdmins(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toHaveLength(2);
  });

  test('returns empty array when no admins', async () => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, { findAll: async () => [] });
    const ctx = makeCtx();
    const res = await listAdmins(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body).toHaveLength(0);
  });
});
