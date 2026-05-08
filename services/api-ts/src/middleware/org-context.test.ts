import { describe, test, expect } from 'bun:test';
import { orgContextMiddleware } from './org-context';

/**
 * Org-context middleware tests.
 *
 * Tests verify access control logic without a real database.
 * The middleware is tested via a minimal mock context that simulates
 * Hono's ctx.get/ctx.set/ctx.req and Drizzle query results.
 */

function makeMockCtx(overrides: {
  user?: { id: string; role?: string } | null;
  orgId?: string | null;
  membershipRows?: any[];
  adminRows?: any[];
} = {}) {
  const vars: Record<string, any> = {
    user: overrides.user === null ? undefined : (overrides.user ?? { id: 'user-1', role: 'user' }),
  };

  const headerOrgId = overrides.orgId === null ? null : (overrides.orgId ?? 'org-1');

  // Build a chainable mock for Drizzle: db.select().from().where().limit()
  const membershipRows = overrides.membershipRows ?? [];
  const adminRows = overrides.adminRows ?? [];

  const makeChain = (rows: any[]) => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(rows),
      }),
    }),
  });

  let selectCallCount = 0;
  const mockDb = {
    select: (fields?: any) => {
      selectCallCount++;
      // First select call = platform admin check, second = membership check
      if (selectCallCount === 1) return makeChain(adminRows);
      return makeChain(membershipRows);
    },
  };

  vars['database'] = mockDb;

  let nextCalled = false;

  const ctx = {
    get: (key: string) => vars[key],
    set: (key: string, val: any) => { vars[key] = val; },
    req: {
      path: '/test-path',
      method: 'GET',
      header: (name: string) => name === 'x-org-id' ? headerOrgId : null,
      query: () => null,
      param: () => undefined,
    },
    json: (body: any, status: number) => ({ status, body }) as any as Response,
  };

  const next = async () => { nextCalled = true; };

  return { ctx, next, vars, isNextCalled: () => nextCalled, resetSelectCount: () => { selectCallCount = 0; } };
}

describe('orgContextMiddleware', () => {
  const middleware = orgContextMiddleware();

  test('returns 401 when no user authenticated', async () => {
    const { ctx, next } = makeMockCtx({ user: null });
    const response = await middleware(ctx as any, next) as any;
    expect(response.status).toBe(401);
  });

  test('returns 403 when no orgId provided', async () => {
    const { ctx, next } = makeMockCtx({ orgId: null });
    const response = await middleware(ctx as any, next) as any;
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Organization context required');
  });

  test('returns 403 when user is not a member of the org', async () => {
    const { ctx, next } = makeMockCtx({
      membershipRows: [],
      adminRows: [],
    });
    const response = await middleware(ctx as any, next) as any;
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Not a member');
  });

  test('passes when user has active membership', async () => {
    const { ctx, next, vars, isNextCalled } = makeMockCtx({
      membershipRows: [{
        id: 'mem-1',
        personId: 'user-1',
        organizationId: 'org-1',
        status: 'active',
      }],
      adminRows: [],
    });

    await middleware(ctx as any, next);

    expect(isNextCalled()).toBe(true);
    expect(vars['orgId']).toBe('org-1');
    expect(vars['orgMembership']).toEqual({
      membershipId: 'mem-1',
      personId: 'user-1',
      orgId: 'org-1',
      role: 'member',
      status: 'active',
    });
  });

  test('platform admin bypasses membership check', async () => {
    const { ctx, next, vars, isNextCalled } = makeMockCtx({
      adminRows: [{ id: 'admin-1' }],
      membershipRows: [], // no membership — should still pass
    });

    await middleware(ctx as any, next);

    expect(isNextCalled()).toBe(true);
    expect(vars['orgMembership']?.role).toBe('admin');
    expect(vars['orgMembership']?.membershipId).toBe('platform-admin');
  });
});
