import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getMyPrivacySettings } from './getMyPrivacySettings';

describe('getMyPrivacySettings', () => {
  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getMyPrivacySettings(ctx)).rejects.toThrow('Unauthorized');
  });

  test('returns 200 on happy path (no orgId)', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _query: {} });
    const res = await getMyPrivacySettings(ctx);
    expect(res.status).toBe(200);
  });
});
