import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getMyMemberships } from './getMyMemberships';

describe('getMyMemberships', () => {
  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getMyMemberships(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: async () => [],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyMemberships(ctx);
    expect(res.status).toBe(200);
  });
});
