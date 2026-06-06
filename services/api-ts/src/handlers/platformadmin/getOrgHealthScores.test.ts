/**
 * getOrgHealthScores — characterization tests
 *
 * Path: GET /admin/analytics/health
 * Auth: platformAdmin guard required (D-01 fixed).
 * Uses direct Drizzle queries (no repo class).
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getOrgHealthScores } from './getOrgHealthScores';

const FAKE_PLATFORM_ADMIN = { userId: 'admin-1', role: 'super' };

function makeHealthCtx(overrides: Record<string, any> = {}) {
  const ctx = makeCtx(overrides);
  // getOrgHealthScores uses `new URL(ctx.req.url)` for query params
  (ctx.req as any).url = 'http://localhost:7213/admin/analytics/health';
  return ctx;
}

function makeDbWithHealthRows(rows: any[]) {
  // getOrgHealthScores uses db.execute(sql`...`) — returns { rows: [...] }
  return {
    execute: async () => ({ rows }),
  };
}

const fakeOrgRow = {
  organizationId: 'org-1',
  organizationName: 'Manila Chapter',
  totalMembers: 50,
  activeMembers: 40,
  duesCollected: '50000',
  duesExpected: '58823',
  updatedAt: new Date(),
};

describe('getOrgHealthScores (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeHealthCtx({ session: null, user: null });
    const res = await getOrgHealthScores(ctx);
    expect(res.status).toBe(401);
  });

  // D-01 FIXED: guard now rejects non-platformAdmin users with 403
  test('returns 403 for authenticated user without platformAdmin role', async () => {
    const ctx = makeHealthCtx({
      user: { id: 'member-1', role: 'member' },
      // platformAdmin intentionally absent
    });
    const res = await getOrgHealthScores(ctx);
    expect(res.status).toBe(403);
  });

  // Positive case: platformAdmin CAN access
  test('returns 200 with health data for platformAdmin user', async () => {
    const ctx = makeHealthCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: FAKE_PLATFORM_ADMIN,
      database: makeDbWithHealthRows([fakeOrgRow]),
    });
    const res = await getOrgHealthScores(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data).toBeDefined();
    expect(Array.isArray(body?.data)).toBe(true);
  });

  test('returns 200 with empty data when no orgs', async () => {
    const ctx = makeHealthCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: FAKE_PLATFORM_ADMIN,
      database: makeDbWithHealthRows([]),
    });
    const res = await getOrgHealthScores(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toEqual([]);
  });

  test('includes meta with limit, offset, hasMore', async () => {
    // Fill exactly limit=20 rows to trigger hasMore=true
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...fakeOrgRow, organizationId: `org-${i}` }));
    const ctx = makeHealthCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: FAKE_PLATFORM_ADMIN,
      database: makeDbWithHealthRows(rows),
    });
    const res = await getOrgHealthScores(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.meta?.hasMore).toBe(true);
    expect(body?.meta?.limit).toBe(20);
  });

  test('handles DB error gracefully — returns 500', async () => {
    const badDb = {
      execute: () => { throw new Error('DB connection failed'); },
    };
    const ctx = makeHealthCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: FAKE_PLATFORM_ADMIN,
      database: badDb,
    });
    const res = await getOrgHealthScores(ctx);
    expect(res.status).toBe(500);
  });
});
