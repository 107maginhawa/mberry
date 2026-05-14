import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getPrivacySettings } from './getPrivacySettings';

describe('getPrivacySettings', () => {
  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null });
    const res = await getPrivacySettings(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 on happy path (no orgId)', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    (ctx as any).req.query = (key: string) => null;
    const res = await getPrivacySettings(ctx);
    expect(res.status).toBe(200);
  });

  test('returns 200 with defaults when no row found for orgId', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    (ctx as any).req.query = (key: string) => key === 'organizationId' ? 'org-1' : null;
    const res = await getPrivacySettings(ctx);
    expect(res.status).toBe(200);
  });
});
