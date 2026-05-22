import { describe, test, expect, mock } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { updateMyPrivacySettings } from './updateMyPrivacySettings';

mock.module('@/utils/audit', () => ({ auditAction: async () => {} }));

describe('updateMyPrivacySettings', () => {
  test('throws Unauthorized when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(updateMyPrivacySettings(ctx)).rejects.toThrow('Unauthorized');
  });

  test('throws ValidationError when organizationId missing', async () => {
    const ctx = makeCtx({ _body: {} });
    await expect(updateMyPrivacySettings(ctx)).rejects.toThrow('organizationId is required');
  });

  test('throws ForbiddenError when not a member', async () => {
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
    await expect(updateMyPrivacySettings(ctx)).rejects.toThrow('Not a member of this organization');
  });

  test('returns 201 on happy path', async () => {
    const calls: string[] = [];
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              calls.push('select');
              if (calls.length === 1) return [{ id: 'mem-1' }]; // membership
              return []; // no existing privacy row
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
    const ctx = makeCtx({ database: mockDb, _body: { organizationId: 'org-1', emailVisible: true } });
    const res = await updateMyPrivacySettings(ctx);
    expect(res.status).toBe(201);
  });
});
