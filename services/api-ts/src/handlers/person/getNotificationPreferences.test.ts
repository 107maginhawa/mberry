import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getNotificationPreferences } from './getNotificationPreferences';

describe('getNotificationPreferences', () => {
  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null });
    const res = await getNotificationPreferences(ctx);
    expect(res.status).toBe(401);
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
    const res = await getNotificationPreferences(ctx);
    expect(res.status).toBe(200);
  });
});
