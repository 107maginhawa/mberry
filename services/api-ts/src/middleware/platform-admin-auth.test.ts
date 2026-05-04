import { describe, test, expect, afterEach } from 'bun:test';
import { platformAdminAuthMiddleware } from './platform-admin-auth';
import { stubRepo } from '@/test-utils/make-ctx';
import { PlatformAdminRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';
import { ForbiddenError } from '@/core/errors';

function makeMwCtx(overrides: Record<string, any> = {}) {
  const vars: Record<string, any> = {
    user: { id: 'user-1', role: 'user' },
    database: {},
    ...overrides,
  };
  return {
    get: (key: string) => vars[key],
    set: (key: string, val: any) => { vars[key] = val; },
    req: { header: () => null },
  } as any;
}

const superAdmin = {
  id: 'pa-1',
  userId: 'user-1',
  email: 'admin@example.com',
  name: 'Super Admin',
  role: 'super',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('platformAdminAuthMiddleware', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  afterEach(() => {
    if (mocks) {
      for (const m of Object.values(mocks)) m.mockRestore();
    }
  });

  test('throws ForbiddenError when no user in context', async () => {
    const mw = platformAdminAuthMiddleware();
    const ctx = makeMwCtx({ user: undefined });
    await expect(mw(ctx, async () => {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws ForbiddenError when user is not a platform admin', async () => {
    mocks = stubRepo(PlatformAdminRepository, {
      findByUserId: async () => undefined,
    });
    const mw = platformAdminAuthMiddleware();
    const ctx = makeMwCtx({ user: { id: 'regular-user', role: 'user' } });
    await expect(mw(ctx, async () => {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('calls next and sets platformAdmin when user is admin', async () => {
    mocks = stubRepo(PlatformAdminRepository, {
      findByUserId: async () => superAdmin,
    });
    const mw = platformAdminAuthMiddleware();
    const ctx = makeMwCtx({ user: { id: 'user-1', role: 'user' } });
    let nextCalled = false;
    await mw(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(ctx.get('platformAdmin')).toEqual(superAdmin);
  });

  test('works for all admin roles (super, support, analyst)', async () => {
    for (const role of ['super', 'support', 'analyst']) {
      const admin = { ...superAdmin, role };
      mocks = stubRepo(PlatformAdminRepository, {
        findByUserId: async () => admin,
      });
      const mw = platformAdminAuthMiddleware();
      const ctx = makeMwCtx({ user: { id: 'user-1', role: 'user' } });
      let nextCalled = false;
      await mw(ctx, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      expect(ctx.get('platformAdmin').role).toBe(role);
      for (const m of Object.values(mocks)) m.mockRestore();
    }
  });
});
