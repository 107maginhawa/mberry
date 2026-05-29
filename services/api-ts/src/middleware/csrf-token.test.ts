/**
 * Tests for CSRF token middleware (double-submit cookie pattern).
 *
 * Defense-in-depth above Hono's origin-based csrf() and SameSite cookies.
 * Verifies:
 *   - Safe methods (GET/HEAD/OPTIONS) bypass token check.
 *   - State-changing methods without token → 403.
 *   - Mismatched cookie/header tokens → 403.
 *   - Matched cookie/header tokens → next() called.
 *   - Allowlisted paths (webhooks, public unsubscribe) bypass.
 *   - GET /csrf-token issues a token cookie + JSON.
 */

import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import {
  createCsrfTokenMiddleware,
  CSRF_HEADER,
  CSRF_COOKIE,
  registerCsrfTokenEndpoint,
} from '@/middleware/csrf-token';

function buildApp(opts?: { allowlist?: string[] }) {
  const app = new Hono();
  registerCsrfTokenEndpoint(app);
  app.use('*', createCsrfTokenMiddleware({ allowlist: opts?.allowlist ?? [] }));
  app.post('/echo', async (c) => c.json({ ok: true }));
  app.put('/echo', async (c) => c.json({ ok: true }));
  app.patch('/echo', async (c) => c.json({ ok: true }));
  app.delete('/echo', async (c) => c.json({ ok: true }));
  app.get('/echo', async (c) => c.json({ ok: true }));
  return app;
}

describe('csrf-token middleware', () => {
  it('lets GET pass without token', async () => {
    const app = buildApp();
    const res = await app.request('/echo', { method: 'GET' });
    expect(res.status).toBe(200);
  });

  it('lets HEAD pass without token', async () => {
    const app = buildApp();
    const res = await app.request('/echo', { method: 'HEAD' });
    expect(res.status).toBe(200);
  });

  it('lets OPTIONS pass without token', async () => {
    const app = buildApp();
    const res = await app.request('/echo', { method: 'OPTIONS' });
    // Hono returns 404 for unmatched OPTIONS unless cors is wired; this middleware
    // must let it through. We assert the middleware itself does not 403 it.
    expect(res.status).not.toBe(403);
  });

  it('rejects POST without header token', async () => {
    const app = buildApp();
    const res = await app.request('/echo', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'CSRF_TOKEN_MISSING' });
  });

  it('rejects POST when header and cookie mismatch', async () => {
    const app = buildApp();
    const res = await app.request('/echo', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE}=token-A`,
        [CSRF_HEADER]: 'token-B',
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'CSRF_TOKEN_MISMATCH' });
  });

  it('rejects POST when header present but no cookie', async () => {
    const app = buildApp();
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { [CSRF_HEADER]: 'token-A' },
    });
    expect(res.status).toBe(403);
  });

  it('accepts POST when header matches cookie', async () => {
    const app = buildApp();
    const res = await app.request('/echo', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE}=matching-token-xyz`,
        [CSRF_HEADER]: 'matching-token-xyz',
      },
    });
    expect(res.status).toBe(200);
  });

  it('rejects PUT and PATCH and DELETE the same way as POST', async () => {
    const app = buildApp();
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const res = await app.request('/echo', { method });
      expect(res.status).toBe(403);
    }
  });

  it('bypasses POST on allowlisted prefix (webhook)', async () => {
    const app = buildApp({ allowlist: ['/webhooks/'] });
    app.post('/webhooks/stripe', async (c) => c.json({ ok: true }));
    const res = await app.request('/webhooks/stripe', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('GET /csrf-token issues a token cookie and returns the token', async () => {
    const app = buildApp();
    const res = await app.request('/csrf-token', { method: 'GET' });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${CSRF_COOKIE}=`);
    const body = await res.json();
    expect(body).toHaveProperty('token');
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThanOrEqual(32);
  });

  it('reject reason "missing" surfaces a distinct code from mismatch', async () => {
    const app = buildApp();
    const missing = await app.request('/echo', { method: 'POST' });
    const mismatch = await app.request('/echo', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE}=a`,
        [CSRF_HEADER]: 'b',
      },
    });
    expect((await missing.json()).code).toBe('CSRF_TOKEN_MISSING');
    expect((await mismatch.json()).code).toBe('CSRF_TOKEN_MISMATCH');
  });
});
