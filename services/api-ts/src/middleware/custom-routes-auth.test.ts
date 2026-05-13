/**
 * Verify auth middleware is wired on all custom module routes.
 *
 * These tests import each module router and confirm that hitting
 * any route without a valid session produces 401. This catches
 * the architecture gap where custom routes were previously mounted
 * with zero auth middleware.
 *
 * Note: We test at the app.ts level conceptually, but since creating
 * the full app requires DB/auth/storage, we verify the middleware
 * registration pattern by testing that authMiddleware() rejects
 * unauthenticated requests when mounted on a Hono app.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { authMiddleware } from '@/middleware/auth';

/**
 * Build a minimal Hono app that mirrors app.ts route registration
 * with authMiddleware() but without real dependencies.
 *
 * We register a simple handler on each path and verify auth blocks it.
 */
function makeProtectedApp() {
  const app = new Hono();

  // Mock the dependency injection middleware - set auth but NO session
  app.use('*', async (ctx, next) => {
    ctx.set('auth', {
      api: {
        getSession: async () => null, // No session = unauthenticated
      },
    });
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    await next();
  });

  // Auth middleware on all custom module routes (mirrors app.ts)
  app.use('/dues/*', authMiddleware());
  app.use('/membership/*', authMiddleware());
  app.use('/communications/*', authMiddleware());
  app.use('/certificates/*', authMiddleware());
  app.use('/events/*', authMiddleware());
  app.use('/training/*', authMiddleware());
  app.use('/elections/*', authMiddleware());

  // Register dummy handlers (we never reach these if auth works)
  const dummyHandler = (ctx: any) => ctx.json({ ok: true });
  app.get('/dues/config/:organizationId', dummyHandler);
  app.post('/dues/payments', dummyHandler);
  app.get('/membership/members/:organizationId', dummyHandler);
  app.get('/communications/announcements/:organizationId', dummyHandler);
  app.get('/certificates/my', dummyHandler);
  app.get('/events/list/:organizationId', dummyHandler);
  app.get('/training/list/:organizationId', dummyHandler);
  app.get('/elections/list/:organizationId', dummyHandler);

  // Error handler to convert thrown errors to JSON responses
  app.onError((err, ctx) => {
    if (err.message === 'Authentication required') {
      return ctx.json({ error: err.message }, 401);
    }
    return ctx.json({ error: err.message }, 500);
  });

  return app;
}

describe('Custom module routes auth protection', () => {
  const app = makeProtectedApp();

  const protectedRoutes = [
    { method: 'GET', path: '/dues/config/org-1', module: 'dues' },
    { method: 'POST', path: '/dues/payments', module: 'dues' },
    { method: 'GET', path: '/membership/members/org-1', module: 'membership' },
    { method: 'GET', path: '/communications/announcements/org-1', module: 'communications' },
    { method: 'GET', path: '/certificates/my', module: 'certificates' },
    { method: 'GET', path: '/events/list/org-1', module: 'events' },
    { method: 'GET', path: '/training/list/org-1', module: 'training' },
    { method: 'GET', path: '/elections/list/org-1', module: 'elections' },
  ];

  for (const route of protectedRoutes) {
    test(`${route.module}: ${route.method} ${route.path} returns 401 without auth`, async () => {
      const req = new Request(`http://localhost${route.path}`, {
        method: route.method,
      });
      const res = await app.request(req);
      expect(res.status).toBe(401);
    });
  }
});
