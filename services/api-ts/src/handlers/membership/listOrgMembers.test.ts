import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { listOrgMembers } from './listOrgMembers';

/**
 * listOrgMembers uses raw drizzle DB queries (no repo class to stub).
 * Tests mock the database object at context level.
 */

describe('listOrgMembers', () => {
  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
    });

    await expect(listOrgMembers(ctx as any)).rejects.toThrow();
  });

  test('throws ForbiddenError when user is not member or admin', async () => {
    let callCount = 0;
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              callCount++;
              return []; // not admin, not member
            },
          }),
        }),
      }),
    };

    const ctx = makeCtx({
      user: { id: 'outsider', role: 'user' },
      session: { id: 's-1', userId: 'outsider', user: { id: 'outsider', role: 'user' } },
      database: mockDb,
      _params: { organizationId: 'org-1' },
    });

    await expect(listOrgMembers(ctx as any)).rejects.toThrow();
  });

  test('returns members for org when authorized', async () => {
    let callCount = 0;
    const mockMembers = [
      { id: 'membership-1', personId: 'user-1', firstName: 'Alice', lastName: 'Santos', status: 'active' },
    ];

    // We need to handle two flows:
    // 1. Admin check: select().from(platformAdmins).where().limit() → []
    // 2. Membership check: select().from(memberships).where().limit() → [{ id: 'membership-1' }]
    // 3. Member list: select({ fields }).from(memberships).innerJoin(persons).where() → [mockMembers]
    const mockDb = {
      select: (_fields?: any) => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              callCount++;
              if (callCount === 1) return []; // not admin
              return [{ id: 'membership-1' }]; // is member
            },
          }),
          innerJoin: () => ({
            where: async () => mockMembers,
          }),
        }),
      }),
    };

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      session: { id: 's-1', userId: 'user-1', user: { id: 'user-1', role: 'user' } },
      database: mockDb,
      _params: { organizationId: 'org-1' },
    });

    const res = await listOrgMembers(ctx as any);
    expect(res.status).toBe(200);
    expect((res as any).body.data).toHaveLength(1);
  });
});
