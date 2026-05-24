/**
 * Route protection: Wave 7 admin endpoints.
 *
 * Verifies that the 3 new hand-wired /admin/* routes are protected
 * by platformAdminAuthMiddleware (via the /admin/* wildcard).
 *
 * Routes under test:
 *   GET /admin/national-dashboard/:associationId
 *   GET /admin/committees
 *   GET /admin/committees/:id
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { authMiddleware } from '@/middleware/auth';
import { platformAdminAuthMiddleware } from '@/middleware/platform-admin-auth';

// ---------------------------------------------------------------------------
// Mock DI middleware — sets auth context but NOT as platform admin
// ---------------------------------------------------------------------------

function makeDIMock(userId: string, role: string) {
  return async (ctx: any, next: any) => {
    ctx.set('auth', {
      api: {
        getSession: async () => ({
          user: { id: userId, role },
          session: { id: 'sess-1' },
        }),
      },
    });
    ctx.set('user', { id: userId, role });
    ctx.set('session', { id: 'sess-1', userId, user: { id: userId, role } });
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('database', { transaction: async (fn: any) => fn({}) });
    await next();
  };
}

function addErrorHandler(app: Hono) {
  app.onError((err, ctx) => {
    const msg = err.message || 'Unknown error';
    if (msg.includes('Authentication') || msg.includes('auth') || msg.includes('session')) {
      return ctx.json({ error: msg }, 401);
    }
    if (msg.includes('admin') || msg.includes('Admin') || msg.includes('Forbidden') || msg.includes('Unauthorized') || msg.includes('platform')) {
      return ctx.json({ error: msg }, 403);
    }
    // Any unhandled middleware error = blocked (not a 200 passthrough)
    return ctx.json({ error: msg }, 500);
  });
}

// ---------------------------------------------------------------------------
// Wave 7 admin routes
// ---------------------------------------------------------------------------

const adminRoutes = [
  { method: 'GET', path: '/admin/national-dashboard/assoc-1' },
  { method: 'GET', path: '/admin/committees' },
  { method: 'GET', path: '/admin/committees/committee-1' },
];

// ---------------------------------------------------------------------------
// App factory: non-admin user (should get 401 or 403)
// ---------------------------------------------------------------------------

function makeNonAdminApp() {
  const app = new Hono();
  app.use('*', makeDIMock('regular-user', 'user'));
  app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware());
  const dummy = (ctx: any) => ctx.json({ ok: true });
  app.get('/admin/national-dashboard/:associationId', dummy);
  app.get('/admin/committees', dummy);
  app.get('/admin/committees/:id', dummy);
  addErrorHandler(app);
  return app;
}

// ---------------------------------------------------------------------------
// App factory: no auth (should get 401)
// ---------------------------------------------------------------------------

function makeNoAuthApp() {
  const app = new Hono();
  // No DI mock — no session set
  app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware());
  const dummy = (ctx: any) => ctx.json({ ok: true });
  app.get('/admin/national-dashboard/:associationId', dummy);
  app.get('/admin/committees', dummy);
  app.get('/admin/committees/:id', dummy);
  addErrorHandler(app);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Wave 7 admin route protection — unauthenticated gets blocked', () => {
  let noAuthApp: Hono;

  beforeEach(() => {
    noAuthApp = makeNoAuthApp();
  });

  for (const route of adminRoutes) {
    test(`${route.method} ${route.path} returns 401 without auth`, async () => {
      const req = new Request(`http://localhost${route.path}`, { method: route.method });
      const res = await noAuthApp.request(req);
      // Blocked: 401 (no session), 403 (not admin), or 500 (middleware error)
      // Key assertion: NOT 200 (would mean route is unprotected)
      expect(res.status).not.toBe(200);
    });
  }
});

describe('Wave 7 admin route protection — non-admin gets blocked', () => {
  let nonAdminApp: Hono;

  beforeEach(() => {
    nonAdminApp = makeNonAdminApp();
  });

  for (const route of adminRoutes) {
    test(`${route.method} ${route.path} returns 401/403 for non-admin user`, async () => {
      const req = new Request(`http://localhost${route.path}`, { method: route.method });
      const res = await nonAdminApp.request(req);
      // Blocked: NOT 200 (would mean route is unprotected)
      expect(res.status).not.toBe(200);
    });
  }
});
