/**
 * RED phase: Officer protection on hand-wired app.ts routes.
 *
 * These tests verify that officer-only routes return 403 to authenticated
 * members (no active officer term) and 200 to officers (active term).
 *
 * The mock apps here wire officerAuthMiddleware() CORRECTLY — so these
 * tests pass against the mock. They document the target behavior that
 * Plan 03 (GREEN) will achieve by adding officerAuthMiddleware() to
 * the real app.ts inline routes.
 *
 * Routes under test (from TDD-AUTH-PLAN section 1.1):
 *   PUT  /membership/org-profile/:orgId  — officer only
 *   GET  /membership/members/:orgId      — officer only
 *   GET  /membership/applications/:orgId — officer only
 *   GET  /dues/dashboard/:orgId          — officer only
 *   GET  /credit-compliance/:orgId       — officer only
 *   GET  /officer-terms/:orgId           — officer only
 *
 * Read-only routes that stay member-accessible (D-07):
 *   GET  /membership/org-profile/:orgId  — member allowed
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { authMiddleware } from '@/middleware/auth';
import { officerAuthMiddleware } from '@/middleware/officer-auth';

// ---------------------------------------------------------------------------
// Module mock: OfficerTermRepository.findActiveByPersonAndOrg
// We control the return value per app factory to simulate member vs officer.
// ---------------------------------------------------------------------------

const mockFindActiveByPersonAndOrg = mock(async (_personId: string, _orgId: string) => {
  return [] as any[];
});

mock.module('@/handlers/association:member/repos/governance.repo', () => ({
  OfficerTermRepository: class {
    findActiveByPersonAndOrg = mockFindActiveByPersonAndOrg;
  },
  PositionRepository: class {
    async findByOrg() { return []; }
  },
}));

// ---------------------------------------------------------------------------
// Shared mock DI middleware (sets user + logger + database on context)
// ---------------------------------------------------------------------------

function makeDIMock(userId: string) {
  return async (ctx: any, next: any) => {
    ctx.set('auth', {
      api: {
        getSession: async () => ({
          user: { id: userId, role: 'user' },
          session: { id: 'sess-1' },
        }),
      },
    });
    ctx.set('user', { id: userId, role: 'user' });
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('database', {}); // officerAuthMiddleware uses OfficerTermRepository (mocked above)
    await next();
  };
}

// ---------------------------------------------------------------------------
// Error handler (D-08) — converts ForbiddenError/AuthError to JSON
// ---------------------------------------------------------------------------

function addErrorHandler(app: Hono) {
  app.onError((err, ctx) => {
    if (err.message === 'Authentication required') {
      return ctx.json({ error: err.message }, 401);
    }
    if (err.message.includes('Officer access') || err.message.includes('Forbidden')) {
      return ctx.json({ error: err.message }, 403);
    }
    return ctx.json({ error: err.message }, 500);
  });
}

// ---------------------------------------------------------------------------
// Officer-only routes (mirror app.ts target state after Plan 03)
// ---------------------------------------------------------------------------

const officerRoutes = [
  { method: 'PUT', path: '/membership/org-profile/:orgId' },
  { method: 'GET', path: '/membership/members/:orgId' },
  { method: 'GET', path: '/membership/applications/:orgId' },
  { method: 'GET', path: '/dues/dashboard/:orgId' },
  { method: 'GET', path: '/credit-compliance/:orgId' },
  { method: 'GET', path: '/officer-terms/:orgId' },
];

// ---------------------------------------------------------------------------
// App factory: member (authenticated, no active officer term → 403)
// ---------------------------------------------------------------------------

function makeMemberApp() {
  const app = new Hono();

  // Inject mock DI
  app.use('*', makeDIMock('member-user-id'));

  const dummy = (ctx: any) => ctx.json({ ok: true });

  // Officer-only routes — auth + officer middleware (target wiring per Plan 03)
  app.put('/membership/org-profile/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/membership/members/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/membership/applications/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/dues/dashboard/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/credit-compliance/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/officer-terms/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);

  // Member read-only route — auth only (D-07)
  app.get('/membership/org-profile/:orgId', authMiddleware(), dummy);

  addErrorHandler(app);
  return app;
}

// ---------------------------------------------------------------------------
// App factory: officer (authenticated, has active term → 200)
// ---------------------------------------------------------------------------

function makeOfficerApp() {
  const app = new Hono();

  // Inject mock DI
  app.use('*', makeDIMock('officer-user-id'));

  const dummy = (ctx: any) => ctx.json({ ok: true });

  // Same wiring as member app
  app.put('/membership/org-profile/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/membership/members/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/membership/applications/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/dues/dashboard/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/credit-compliance/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);
  app.get('/officer-terms/:orgId', authMiddleware(), officerAuthMiddleware(), dummy);

  // Member read-only route — auth only (D-07)
  app.get('/membership/org-profile/:orgId', authMiddleware(), dummy);

  addErrorHandler(app);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Hand-wired route officer protection — member gets 403', () => {
  let memberApp: Hono;

  beforeEach(() => {
    // Member: findActiveByPersonAndOrg returns empty array (no officer term)
    mockFindActiveByPersonAndOrg.mockImplementation(async () => []);
    memberApp = makeMemberApp();
  });

  afterEach(() => {
    mockFindActiveByPersonAndOrg.mockRestore();
  });

  for (const route of officerRoutes) {
    const concreteUrl = route.path.replace(':orgId', 'org-1');
    test(`${route.method} ${concreteUrl} returns 403 for member`, async () => {
      const req = new Request(`http://localhost${concreteUrl}`, { method: route.method });
      const res = await memberApp.request(req);
      expect(res.status).toBe(403);
    });
  }

  test('GET /membership/org-profile/org-1 returns 200 for member (read-only, D-07)', async () => {
    const req = new Request('http://localhost/membership/org-profile/org-1', { method: 'GET' });
    const res = await memberApp.request(req);
    expect(res.status).toBe(200);
  });
});

describe('Hand-wired route officer protection — officer gets 200', () => {
  let officerApp: Hono;

  beforeEach(() => {
    // Officer: findActiveByPersonAndOrg returns one active term
    mockFindActiveByPersonAndOrg.mockImplementation(async () => [{ id: 'term-1', status: 'active' }]);
    officerApp = makeOfficerApp();
  });

  afterEach(() => {
    mockFindActiveByPersonAndOrg.mockRestore();
  });

  for (const route of officerRoutes) {
    const concreteUrl = route.path.replace(':orgId', 'org-1');
    test(`${route.method} ${concreteUrl} returns 200 for officer`, async () => {
      const req = new Request(`http://localhost${concreteUrl}`, { method: route.method });
      const res = await officerApp.request(req);
      expect(res.status).toBe(200);
    });
  }

  test('GET /membership/org-profile/org-1 returns 200 for officer (read-only, D-07)', async () => {
    const req = new Request('http://localhost/membership/org-profile/org-1', { method: 'GET' });
    const res = await officerApp.request(req);
    expect(res.status).toBe(200);
  });
});
