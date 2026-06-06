/**
 * getOrgHealthScores — characterization tests
 *
 * Path: GET /admin/analytics/health
 * Auth: session required (no explicit admin guard found — DEFECT potential)
 * Uses direct Drizzle queries (no repo class).
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getOrgHealthScores } from './getOrgHealthScores';

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

  test('returns 200 with health data for authenticated user', async () => {
    const ctx = makeHealthCtx({
      user: { id: 'user-1', role: 'platform_admin' },
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
      user: { id: 'user-1', role: 'platform_admin' },
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
      user: { id: 'user-1', role: 'platform_admin' },
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
      user: { id: 'user-1', role: 'platform_admin' },
      database: badDb,
    });
    const res = await getOrgHealthScores(ctx);
    expect(res.status).toBe(500);
  });

  // DEFECT: no explicit platform admin check — any authenticated user can access health scores
  // This is a potential access-control gap. Logged for Wave 1.5 review.
  test.skip('DEFECT: returns 403 for non-admin user (currently returns 200)', async () => {
    const ctx = makeHealthCtx({
      user: { id: 'member-1', role: 'member' },
      database: makeDbWithHealthRows([fakeOrgRow]),
    });
    const res = await getOrgHealthScores(ctx);
    expect(res.status).toBe(403);
  });
});
