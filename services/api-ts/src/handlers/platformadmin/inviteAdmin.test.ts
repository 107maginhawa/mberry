import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { inviteAdmin } from './inviteAdmin';
import { ConflictError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';

const newAdmin = { id: 'admin-new', userId: 'u-new', email: 'new@example.com', name: 'New Admin', role: 'support' };

describe('inviteAdmin', () => {
  beforeEach(() => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, {
      findByEmail: async () => null,
      create: async () => newAdmin,
    });
  });

  afterEach(() => {
    restoreRepo(PlatformAdminRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _body: { email: 'x@x.com', name: 'X', role: 'support' } });
    const res = await inviteAdmin(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 201 on success', async () => {
    const ctx = makeCtx({ _body: { email: 'new@example.com', name: 'New Admin', role: 'support' }, platformAdmin: { id: 'pa-1', role: 'super' } });
    const res = await inviteAdmin(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body?.email).toBe('new@example.com');
  });

  test('throws ConflictError when email already exists', async () => {
    restoreRepo(PlatformAdminRepository);
    stubRepo(PlatformAdminRepository, {
      findByEmail: async () => newAdmin,
      create: async () => newAdmin,
    });
    const ctx = makeCtx({ _body: { email: 'new@example.com', name: 'X', role: 'support' }, platformAdmin: { id: 'pa-1', role: 'super' } });
    await expect(inviteAdmin(ctx)).rejects.toBeInstanceOf(ConflictError);
  });

  // [EM-M03-d1e2f3a4]
  test('emits admin.invited', async () => {
    const emitSpy = spyOn(domainEvents, 'emit');
    const ctx = makeCtx({ _body: { email: 'new@example.com', name: 'New Admin', role: 'support' }, platformAdmin: { id: 'pa-1', role: 'super' } });
    await inviteAdmin(ctx);
    const call = emitSpy.mock.calls.find((c) => c[0] === 'admin.invited');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({ adminId: 'admin-new', email: 'new@example.com', role: 'support' });
    emitSpy.mockRestore();
  });
});
