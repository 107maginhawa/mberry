import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updatePrivacySettings } from './updatePrivacySettings';

describe('updatePrivacySettings', () => {
  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null });
    const res = await updatePrivacySettings(ctx);
    expect(res.status).toBe(401);
  });

  test('throws ForbiddenError when not a member of org', async () => {
    // membership lookup returns empty
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _body: { organizationId: 'org-1' } });
    // override req.json for this handler which uses ctx.req.json()
    (ctx as any).req.json = async () => ({ organizationId: 'org-1' });
    await expect(updatePrivacySettings(ctx)).rejects.toThrow('Not a member of this organization');
  });

  test('returns 201 on happy path (new settings)', async () => {
    const calls: string[] = [];
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              calls.push('select');
              // first call: membership exists; second: no existing privacy row
              if (calls.length === 1) return [{ id: 'mem-1' }];
              return [];
            },
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => [{ id: 'ps-1', personId: 'user-1', organizationId: 'org-1' }],
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb, _body: { organizationId: 'org-1' } });
    (ctx as any).req.json = async () => ({ organizationId: 'org-1', emailVisible: true });
    const res = await updatePrivacySettings(ctx);
    expect(res.status).toBe(201);
  });
});
