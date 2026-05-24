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

  test('returns empty array when user has no memberships', async () => {
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
    const body = (res as any).body;
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  test('returns orgSlug in response data', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: async () => [
              {
                id: 'mem-1',
                organizationId: 'org-1',
                personId: 'user-1',
                orgName: 'Test Org',
                orgSlug: 'test-slug',
                status: 'active',
              },
            ],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyMemberships(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].orgSlug).toBe('test-slug');
  });

  test('enriches membership with orgId alias', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: async () => [
              {
                id: 'mem-2',
                organizationId: 'uuid-123',
                personId: 'user-1',
                orgName: 'Another Org',
                orgSlug: 'another-slug',
                status: 'active',
              },
            ],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyMemberships(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.data).toHaveLength(1);
    expect(body.data[0].orgId).toBe('uuid-123');
    expect(body.data[0].organizationId).toBe('uuid-123');
  });

  test('does not expose PII-adjacent fields (createdBy, updatedBy, note, removalReason)', async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          leftJoin: () => ({
            where: async () => [
              {
                id: 'mem-3',
                organizationId: 'org-1',
                personId: 'user-1',
                orgName: 'Test Org',
                orgSlug: 'test-org',
                status: 'active',
              },
            ],
          }),
        }),
      }),
    };
    const ctx = makeCtx({ database: mockDb });
    const res = await getMyMemberships(ctx);
    const body = (res as any).body;
    const item = body.data[0];
    expect(item).not.toHaveProperty('createdBy');
    expect(item).not.toHaveProperty('updatedBy');
    expect(item).not.toHaveProperty('note');
    expect(item).not.toHaveProperty('removalReason');
    expect(item).not.toHaveProperty('removedAt');
    expect(item).not.toHaveProperty('version');
    expect(item).not.toHaveProperty('createdAt');
    expect(item).not.toHaveProperty('updatedAt');
  });
});
