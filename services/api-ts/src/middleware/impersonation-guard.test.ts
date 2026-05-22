import { describe, test, expect, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { impersonationResolver, impersonationWriteBlock } from './impersonation-guard';
import { stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { ImpersonationSessionRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';
import { AppError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const activeSession = {
  id: 'imp-1',
  adminId: 'admin-1',
  targetUserId: 'target-1',
  targetOrgId: null,
  sessionToken: 'valid-token',
  startedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  endedAt: null,
  createdAt: new Date(), // fresh — within 2 hours
  updatedAt: new Date(),
};

const twoHourOldSession = {
  ...activeSession,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000 - 1), // just over 2 hours ago
  expiresAt: new Date(Date.now() + 60 * 60 * 1000), // expiresAt still in future
};

const expiredSession = {
  ...activeSession,
  expiresAt: new Date(Date.now() - 1000), // already expired
};

const endedSession = {
  ...activeSession,
  endedAt: new Date(), // already ended
};

// ─── Test App Factory ───────────────────────────────────

function createTestApp() {
  const app = new Hono();

  // Fake dependency injection
  app.use('*', async (c, next) => {
    c.set('database', {});
    c.set('logger', { debug: () => {}, warn: () => {}, info: () => {}, error: () => {} });
    await next();
  });

  app.use('*', impersonationResolver());
  app.use('*', impersonationWriteBlock());

  // Test routes
  app.get('/test', (c) => c.json({ ok: true }));
  app.post('/test', (c) => c.json({ created: true }, 201));
  app.put('/test/:id', (c) => c.json({ updated: true }));
  app.delete('/test/:id', (c) => c.json({ deleted: true }));

  // Error handler (mirrors real app behavior)
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    }
    return c.json({ error: 'Internal error' }, 500);
  });

  return app;
}

// ─── Tests ──────────────────────────────────────────────

describe('impersonation-guard middleware', () => {
  beforeEach(() => {
    restoreRepo(ImpersonationSessionRepository);
  });

  describe('no impersonation cookie', () => {
    test('GET passes through', async () => {
      const app = createTestApp();
      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });

    test('POST passes through', async () => {
      const app = createTestApp();
      const res = await app.request('/test', { method: 'POST' });
      expect(res.status).toBe(201);
    });
  });

  describe('active impersonation', () => {
    test('GET allowed during impersonation', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => activeSession,
      });

      const app = createTestApp();
      const res = await app.request('/test', {
        headers: { Cookie: 'memberry-imp-token=valid-token' },
      });
      expect(res.status).toBe(200);
    });

    test('POST blocked with 403 during impersonation', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => activeSession,
      });

      const app = createTestApp();
      const res = await app.request('/test', {
        method: 'POST',
        headers: { Cookie: 'memberry-imp-token=valid-token' },
      });
      expect(res.status).toBe(403);
    });

    test('PUT blocked with 403 during impersonation', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => activeSession,
      });

      const app = createTestApp();
      const res = await app.request('/test/1', {
        method: 'PUT',
        headers: { Cookie: 'memberry-imp-token=valid-token' },
      });
      expect(res.status).toBe(403);
    });

    test('DELETE blocked with 403 during impersonation', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => activeSession,
      });

      const app = createTestApp();
      const res = await app.request('/test/1', {
        method: 'DELETE',
        headers: { Cookie: 'memberry-imp-token=valid-token' },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('expired/ended impersonation', () => {
    test('POST allowed with expired token', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => expiredSession,
      });

      const app = createTestApp();
      const res = await app.request('/test', {
        method: 'POST',
        headers: { Cookie: 'memberry-imp-token=expired-token' },
      });
      expect(res.status).toBe(201);
    });

    test('POST allowed with ended session', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => endedSession,
      });

      const app = createTestApp();
      const res = await app.request('/test', {
        method: 'POST',
        headers: { Cookie: 'memberry-imp-token=ended-token' },
      });
      expect(res.status).toBe(201);
    });

    test('POST allowed with unknown token', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => undefined,
      });

      const app = createTestApp();
      const res = await app.request('/test', {
        method: 'POST',
        headers: { Cookie: 'memberry-imp-token=unknown-token' },
      });
      expect(res.status).toBe(201);
    });
  });

  describe('impersonation session timeout (2-hour max duration)', () => {
    test('rejects expired impersonation session (>2 hours since createdAt)', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => twoHourOldSession,
      });

      const app = createTestApp();
      // GET should pass through (session not set, no write-block applies)
      const getRes = await app.request('/test', {
        headers: { Cookie: 'memberry-imp-token=old-token' },
      });
      expect(getRes.status).toBe(200);

      // POST should also pass through — session is treated as expired (not set)
      const postRes = await app.request('/test', {
        method: 'POST',
        headers: { Cookie: 'memberry-imp-token=old-token' },
      });
      expect(postRes.status).toBe(201);
    });

    test('accepts fresh impersonation session (<2 hours since createdAt)', async () => {
      stubRepo(ImpersonationSessionRepository, {
        findByToken: async () => activeSession,
      });

      const app = createTestApp();
      // GET allowed
      const getRes = await app.request('/test', {
        headers: { Cookie: 'memberry-imp-token=valid-token' },
      });
      expect(getRes.status).toBe(200);

      // POST blocked (write-block active because session is fresh)
      const postRes = await app.request('/test', {
        method: 'POST',
        headers: { Cookie: 'memberry-imp-token=valid-token' },
      });
      expect(postRes.status).toBe(403);
    });
  });
});
