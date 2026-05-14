import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updateNotificationPreferences } from './updateNotificationPreferences';

describe('updateNotificationPreferences', () => {
  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null });
    const res = await updateNotificationPreferences(ctx);
    expect(res.status).toBe(401);
  });

  test('throws ValidationError when category missing', async () => {
    const ctx = makeCtx({ _body: {} });
    await expect(updateNotificationPreferences(ctx)).rejects.toThrow('category is required');
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
    const ctx = makeCtx({ database: mockDb, _body: { category: 'dues', pushEnabled: true } });
    const res = await updateNotificationPreferences(ctx);
    expect(res.status).toBe(201);
  });
});
