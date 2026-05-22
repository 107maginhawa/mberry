import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getMyNotificationPreferences } from './getMyNotificationPreferences';

describe('getMyNotificationPreferences', () => {
  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getMyNotificationPreferences(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyNotificationPreferences(ctx);
    expect(res.status).toBe(200);
  });
});
