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
  method?: string;
  path?: string;
  body?: Record<string, any> | null;
} = {}) {
  const vars: Record<string, any> = {
    user: overrides.user === null ? undefined : (overrides.user ?? { id: 'user-1', role: 'user' }),
  };

  const headerOrgId = overrides.orgId === null ? null : (overrides.orgId ?? 'org-1');
  const method = overrides.method ?? 'GET';
  const path = overrides.path ?? '/test-path';
  const body = overrides.body;

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
      path,
      method,
      header: (name: string) => name === 'x-org-id' ? headerOrgId : null,
      query: () => null,
      param: () => undefined,
      json: body === null
        ? () => Promise.reject(new Error('No body'))
        : () => Promise.resolve(body ?? {}),
    },
    json: (b: any, status: number) => ({ status, body: b }) as any as Response,
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
    const { ctx, next } = makeMockCtx({ orgId: null, body: null });
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

  test('POST with organizationId in body resolves org context correctly', async () => {
    const { ctx, next, vars, isNextCalled } = makeMockCtx({
      orgId: null, // no x-org-id header
      method: 'POST',
      body: { organizationId: 'org-from-body', name: 'Test Event' },
      membershipRows: [{
        id: 'mem-2',
        personId: 'user-1',
        organizationId: 'org-from-body',
        status: 'active',
      }],
      adminRows: [],
    });

    await middleware(ctx as any, next);

    expect(isNextCalled()).toBe(true);
    expect(vars['orgId']).toBe('org-from-body');
  });

  test('POST with orgId in body resolves org context correctly', async () => {
    const { ctx, next, vars, isNextCalled } = makeMockCtx({
      orgId: null,
      method: 'POST',
      body: { orgId: 'org-shortkey', title: 'Meeting' },
      membershipRows: [{
        id: 'mem-3',
        personId: 'user-1',
        organizationId: 'org-shortkey',
        status: 'active',
      }],
      adminRows: [],
    });

    await middleware(ctx as any, next);

    expect(isNextCalled()).toBe(true);
    expect(vars['orgId']).toBe('org-shortkey');
  });

  test('GET does NOT extract orgId from body — returns 403 without header', async () => {
    const { ctx, next } = makeMockCtx({
      orgId: null,
      method: 'GET',
      body: { organizationId: 'org-in-body' }, // should be ignored for GET
      membershipRows: [],
      adminRows: [],
    });

    const response = await middleware(ctx as any, next) as any;
    // GET should not attempt body extraction — orgId stays null → 403
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Organization context required');
  });

  test('nested route /association/events/:eventId/cancel resolves orgId from x-org-id header, not path param', async () => {
    const eventId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const { ctx, next, vars, isNextCalled } = makeMockCtx({
      orgId: 'org-header', // x-org-id header
      method: 'POST',
      path: `/association/events/${eventId}/cancel`,
      body: null,
      membershipRows: [{
        id: 'mem-4',
        personId: 'user-1',
        organizationId: 'org-header',
        status: 'active',
      }],
      adminRows: [],
    });

    await middleware(ctx as any, next);

    expect(isNextCalled()).toBe(true);
    // Must be the header value, NOT the eventId UUID
    expect(vars['orgId']).toBe('org-header');
    expect(vars['orgId']).not.toBe(eventId);
  });
});
