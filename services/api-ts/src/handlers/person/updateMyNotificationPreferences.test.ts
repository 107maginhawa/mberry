import { describe, test, expect, mock } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updateMyNotificationPreferences } from './updateMyNotificationPreferences';

mock.module('@/core/audit/audit-action', () => ({ auditAction: async () => {} }));

describe('updateMyNotificationPreferences', () => {
  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(updateMyNotificationPreferences(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws ValidationError when category missing', async () => {
    const ctx = makeCtx({ _body: {} });
    await expect(updateMyNotificationPreferences(ctx)).rejects.toThrow('category is required');
  });

  test('throws ValidationError for invalid category', async () => {
    const ctx = makeCtx({ _body: { preferences: [{ category: 'invalid-cat' }] } });
    await expect(updateMyNotificationPreferences(ctx)).rejects.toThrow('Invalid category');
  });

  test('returns 201 on happy path (new pref)', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => [{ id: 'pref-1', category: 'dues', pushEnabled: true, emailEnabled: false }],
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _body: { preferences: [{ category: 'dues', pushEnabled: true }] } });
    const res = await updateMyNotificationPreferences(ctx);
    expect(res.status).toBe(201);
  });
});
