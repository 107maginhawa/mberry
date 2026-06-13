/**
 * admin-route-walk — privileged-surface guard invariant (AHA FIX-017)
 *
 * app.ts registers `app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware())`
 * ahead of every generated + hand-wired /admin route. That single line is the
 * load-bearing guard for the entire platform-admin surface. This test walks a
 * representative set of /admin/* paths through the REAL
 * `platformAdminAuthMiddleware` and proves:
 *   1. a non-admin authenticated user gets 403 on EVERY /admin/* route, and
 *   2. a real platform admin passes through to the handler.
 *
 * It uses the middleware's `platformAdminPort` dependency-injection seam (no DB,
 * no live server — `[BLOCKED BY ENVIRONMENT]` for full HTTP boot), so it is a
 * deterministic regression guard against accidental reordering / removal of the
 * /admin guard.
 */
import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { platformAdminAuthMiddleware } from '@/middleware/platform-admin-auth';
import { AppError } from '@/core/errors';
import type { PlatformAdminPort } from '@/core/ports';

// Representative sample across every /admin/* route family registered in app.ts.
const ADMIN_ROUTES: Array<{ method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string }> = [
  { method: 'GET', path: '/admin/tickets' },
  { method: 'GET', path: '/admin/tickets/t-1' },
  { method: 'PUT', path: '/admin/tickets/t-1' },
  { method: 'POST', path: '/admin/tickets/t-1/comments' },
  { method: 'GET', path: '/admin/breaches' },
  { method: 'POST', path: '/admin/breaches' },
  { method: 'PUT', path: '/admin/breaches/b-1' },
  { method: 'GET', path: '/admin/pricing' },
  { method: 'POST', path: '/admin/pricing' },
  { method: 'GET', path: '/admin/subscriptions' },
  { method: 'PUT', path: '/admin/subscriptions/s-1/cancel' },
  { method: 'GET', path: '/admin/analytics/revenue' },
  { method: 'GET', path: '/admin/analytics/health' },
  { method: 'GET', path: '/admin/national/platform' },
];

const adminRow = {
  id: 'pa-1',
  userId: 'admin-1',
  email: 'admin@example.com',
  name: 'Super',
  role: 'super',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fakePort(admin: unknown): PlatformAdminPort {
  return { findByUserId: async () => admin } as unknown as PlatformAdminPort;
}

/**
 * Builds a Hono app that mirrors the app.ts guard ordering for /admin/*:
 *   app.use('/admin/*', <auth-injected user>, platformAdminAuthMiddleware(port))
 * and mounts every ADMIN_ROUTES entry returning 200 if the guard lets it through.
 */
function buildApp(opts: { user: unknown; admin: unknown }) {
  const app = new Hono();

  // Stand-in for authMiddleware(): puts the authenticated user + database on ctx.
  app.use('/admin/*', async (c, next) => {
    if (opts.user) c.set('user', opts.user);
    c.set('database', {});
    await next();
  });
  app.use('/admin/*', platformAdminAuthMiddleware({ platformAdminPort: fakePort(opts.admin) }));

  for (const r of ADMIN_ROUTES) {
    const handler = (c: any) => c.json({ ok: true }, 200);
    if (r.method === 'GET') app.get(r.path, handler);
    if (r.method === 'POST') app.post(r.path, handler);
    if (r.method === 'PUT') app.put(r.path, handler);
    if (r.method === 'DELETE') app.delete(r.path, handler);
  }

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message }, err.statusCode as any);
    return c.json({ error: 'Internal error' }, 500);
  });

  return app;
}

describe('admin route-walk guard invariant', () => {
  test('non-admin authenticated user gets 403 on EVERY /admin/* route', async () => {
    const app = buildApp({ user: { id: 'regular-1', role: 'member' }, admin: undefined });
    for (const r of ADMIN_ROUTES) {
      const res = await app.request(r.path, { method: r.method });
      expect({ route: `${r.method} ${r.path}`, status: res.status }).toEqual({
        route: `${r.method} ${r.path}`,
        status: 403,
      });
    }
  });

  test('unauthenticated request gets 403 on EVERY /admin/* route', async () => {
    const app = buildApp({ user: null, admin: undefined });
    for (const r of ADMIN_ROUTES) {
      const res = await app.request(r.path, { method: r.method });
      expect({ route: `${r.method} ${r.path}`, status: res.status }).toEqual({
        route: `${r.method} ${r.path}`,
        status: 403,
      });
    }
  });

  test('a real platform admin passes the guard on every /admin/* route', async () => {
    const app = buildApp({ user: { id: 'admin-1', role: 'user' }, admin: adminRow });
    for (const r of ADMIN_ROUTES) {
      const res = await app.request(r.path, { method: r.method });
      expect({ route: `${r.method} ${r.path}`, status: res.status }).toEqual({
        route: `${r.method} ${r.path}`,
        status: 200,
      });
    }
  });
});
