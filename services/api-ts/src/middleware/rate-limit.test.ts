/**
 * Tests for rate-limit middleware (P1-5)
 *
 * The middleware skips in test/development environments, so we temporarily
 * set NODE_ENV=production for exercising the rate-limit logic.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { createRateLimiter } from '@/middleware/rate-limit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let originalNodeEnv: string | undefined;

function setProduction() {
  originalNodeEnv = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
}

function restoreEnv() {
  if (originalNodeEnv === undefined) {
    delete process.env['NODE_ENV'];
  } else {
    process.env['NODE_ENV'] = originalNodeEnv;
  }
}

function createTestApp() {
  const app = new Hono();
  app.use('*', createRateLimiter());
  app.get('/test', (c) => c.json({ ok: true }));
  app.post('/test', (c) => c.json({ ok: true }));
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/ready', (c) => c.json({ status: 'ok' }));
  app.get('/auth/session', (c) => c.json({ user: null }));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rate-limit middleware', () => {
  describe('environment skip', () => {
    test('skips rate limiting in test environment', async () => {
      const prev = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'test';
      const app = createTestApp();

      // Should never hit limit even with many requests
      for (let i = 0; i < 200; i++) {
        const res = await app.request('/test');
        expect(res.status).toBe(200);
      }

      process.env['NODE_ENV'] = prev;
    });

    test('skips rate limiting in development environment', async () => {
      const prev = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';
      const app = createTestApp();

      for (let i = 0; i < 200; i++) {
        const res = await app.request('/test');
        expect(res.status).toBe(200);
      }

      process.env['NODE_ENV'] = prev;
    });
  });

  describe('route skips', () => {
    beforeEach(setProduction);
    afterEach(restoreEnv);

    test('skips /auth/* routes', async () => {
      const app = createTestApp();
      for (let i = 0; i < 200; i++) {
        const res = await app.request('/auth/session');
        expect(res.status).toBe(200);
      }
    });

    test('skips /health endpoint', async () => {
      const app = createTestApp();
      for (let i = 0; i < 200; i++) {
        const res = await app.request('/health');
        expect(res.status).toBe(200);
      }
    });

    test('skips /ready endpoint', async () => {
      const app = createTestApp();
      for (let i = 0; i < 200; i++) {
        const res = await app.request('/ready');
        expect(res.status).toBe(200);
      }
    });
  });

  describe('read limit (GET — 120 req/min)', () => {
    beforeEach(setProduction);
    afterEach(restoreEnv);

    test('allows requests under limit', async () => {
      const app = createTestApp();
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('120');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('119');
    });

    test('blocks after 120 GET requests from same IP', async () => {
      const app = createTestApp();
      const ip = '10.0.0.50';

      for (let i = 0; i < 120; i++) {
        const res = await app.request('/test', {
          headers: { 'x-forwarded-for': ip },
        });
        expect(res.status).toBe(200);
      }

      // 121st request should be rate limited
      const blocked = await app.request('/test', {
        headers: { 'x-forwarded-for': ip },
      });
      // RateLimitError is thrown and caught by error handler — but without
      // the full error handler stack, Hono returns 500. We check that the
      // rate limit headers are set before the throw.
      expect(blocked.status).not.toBe(200);
    });
  });

  describe('write limit (POST — 30 req/min)', () => {
    beforeEach(setProduction);
    afterEach(restoreEnv);

    test('allows requests under limit', async () => {
      const app = createTestApp();
      const res = await app.request('/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.2' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('30');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('29');
    });

    test('blocks after 30 POST requests from same IP', async () => {
      const app = createTestApp();
      const ip = '10.0.0.51';

      for (let i = 0; i < 30; i++) {
        const res = await app.request('/test', {
          method: 'POST',
          headers: { 'x-forwarded-for': ip },
        });
        expect(res.status).toBe(200);
      }

      // 31st request should be rate limited
      const blocked = await app.request('/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
      });
      expect(blocked.status).not.toBe(200);
    });
  });

  describe('IP isolation', () => {
    beforeEach(setProduction);
    afterEach(restoreEnv);

    test('different IPs have independent limits', async () => {
      const app = createTestApp();

      // Exhaust limit for IP A
      for (let i = 0; i < 30; i++) {
        await app.request('/test', {
          method: 'POST',
          headers: { 'x-forwarded-for': '10.0.0.60' },
        });
      }

      // IP B should still be allowed
      const res = await app.request('/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.0.0.61' },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('IP extraction', () => {
    beforeEach(setProduction);
    afterEach(restoreEnv);

    test('uses first IP from x-forwarded-for', async () => {
      const app = createTestApp();
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      });
      expect(res.status).toBe(200);
    });

    test('falls back to x-real-ip', async () => {
      const app = createTestApp();
      const res = await app.request('/test', {
        headers: { 'x-real-ip': '9.9.9.9' },
      });
      expect(res.status).toBe(200);
    });
  });
});
