/**
 * AC tests for M03 — Platform Admin
 *
 * REWRITTEN (AHA FIX-001): these acceptance tests previously asserted against
 * test-local helper functions (`impersonationAccessLevel`, `canAccessAdminPanel`,
 * `checkImpersonationWriteBlock`, …) that existed only inside this file and
 * exercised NO production code — a fake-green suite that made the module look
 * verified while the real middleware/handlers were never touched.
 *
 * They now assert against the real production code paths:
 *   - AC-M03-001 / AC-M03-007 → real `impersonationResolver` + `impersonationWriteBlock`
 *   - AC-M03-003             → real `getPlatformSummary` (the actual dashboard data source)
 *   - AC-M03-005             → real `transitionOrgStatus` org-lifecycle state machine
 *   - AC-M03-006             → real `platformAdminAuthMiddleware`
 *
 * Honesty note (AC-M03-006 / G5 — MFA mandatory, M3-R7): MFA is NOT enforced
 * anywhere in production code today. The fix lives in a product-decision-gated
 * batch (Batch B/E — Better-Auth twoFactor wiring) that is out of scope for this
 * test-hardening pass. Rather than leave a fake-green pass asserting a control
 * that does not exist, these tests assert the REAL current behavior (a non-MFA
 * admin is admitted) and the spec gap is documented in the fix report
 * (§9 Remaining Gaps). When G5 lands, the `[GAP]` test below must be flipped to
 * assert rejection.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import {
  impersonationResolver,
  impersonationWriteBlock,
} from '@/middleware/impersonation-guard';
import { platformAdminAuthMiddleware } from '@/middleware/platform-admin-auth';
import { transitionOrgStatus } from './transitionOrgStatus';
import { getPlatformSummary } from './getPlatformSummary';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import {
  ImpersonationSessionRepository,
  PlatformAdminRepository,
  OrganizationRepository,
} from './repos/platform-admin.repo';
import { ForbiddenError, BusinessLogicError } from '@/core/errors';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const activeImpSession = {
  id: 'imp-1',
  adminId: 'admin-1',
  targetUserId: 'target-1',
  targetOrgId: null,
  sessionToken: 'valid-token',
  startedAt: new Date(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  endedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Test app that wires the REAL impersonation middleware (mirrors app.ts:294-295). */
function createImpApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('database', {});
    c.set('logger', FAKE_LOGGER);
    await next();
  });
  app.use('*', impersonationResolver());
  app.use('*', impersonationWriteBlock());
  app.get('/test', (c) => c.json({ ok: true }));
  app.post('/test', (c) => c.json({ created: true }, 201));
  app.put('/test/:id', (c) => c.json({ updated: true }));
  app.patch('/test/:id', (c) => c.json({ patched: true }));
  app.delete('/test/:id', (c) => c.json({ deleted: true }));
  app.onError((err, c) => {
    if (err instanceof ForbiddenError) return c.json({ error: err.message }, 403);
    return c.json({ error: 'Internal error' }, 500);
  });
  return app;
}

// ---------------------------------------------------------------------------
// AC-M03-001: Impersonation — read-only access (real middleware)
// ---------------------------------------------------------------------------

describe('[AC-M03-001] Impersonation Read-Only Access (real impersonation-guard)', () => {
  beforeEach(() => {
    restoreRepo(ImpersonationSessionRepository);
  });

  test('active impersonation session permits GET (read-only viewing)', async () => {
    stubRepo(ImpersonationSessionRepository, { findByToken: async () => activeImpSession });
    const app = createImpApp();
    const res = await app.request('/test', {
      headers: { Cookie: 'memberry-imp-token=valid-token' },
    });
    expect(res.status).toBe(200);
  });

  test('no impersonation cookie → normal write access (none/full access)', async () => {
    const app = createImpApp();
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(201);
  });

  test('active impersonation session blocks writes (read-only enforced, not full)', async () => {
    stubRepo(ImpersonationSessionRepository, { findByToken: async () => activeImpSession });
    const app = createImpApp();
    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: 'memberry-imp-token=valid-token' },
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// AC-M03-003: Dashboard Actionable Items (real getPlatformSummary handler)
// ---------------------------------------------------------------------------

describe('[AC-M03-003] Dashboard / platform summary (real getPlatformSummary)', () => {
  test('rejects non-admin caller (403) — dashboard data is admin-gated', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      session: { id: 's1', userId: 'user-1', user: { id: 'user-1', role: 'member' } },
      _query: {},
      logger: FAKE_LOGGER,
    });
    await expect(getPlatformSummary(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('rejects unauthenticated caller', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: {}, logger: FAKE_LOGGER });
    await expect(getPlatformSummary(ctx)).rejects.toThrow();
  });

  test('platform admin caller is admitted and returns summary rows', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      session: { id: 's1', userId: 'admin-1', user: { id: 'admin-1', role: 'platform_admin' } },
      _query: {},
      logger: FAKE_LOGGER,
    });
    stubRepo(OrganizationRepository, {});
    // Stub the dashboard repo via the handler's collaborators by returning
    // an empty association list — the handler still returns a 200 envelope.
    const { DashboardRepository } = await import('./repos/dashboard.repo');
    const mocks = stubRepo(DashboardRepository, {
      listAssociationIdsForMonth: async () => [],
      getOrgNames: async () => new Map<string, string>(),
    });
    const res = await getPlatformSummary(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toBeDefined();
    for (const m of Object.values(mocks)) m.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AC-M03-005: Org Lifecycle Enforcement (real transitionOrgStatus state machine)
// ---------------------------------------------------------------------------

describe('[AC-M03-005] Org Lifecycle Enforcement (real transitionOrgStatus)', () => {
  beforeEach(() => {
    restoreRepo(OrganizationRepository);
  });

  test('allows a valid transition (active → suspended)', async () => {
    const mocks = stubRepo(OrganizationRepository, {
      findById: async () => ({ id: 'org-1', status: 'active', updatedAt: new Date() }),
      update: async () => ({ id: 'org-1', status: 'suspended' }),
    });
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      session: { id: 's1', userId: 'admin-1', user: { id: 'admin-1' } },
      // FIX-001: transitionOrgStatus is super-only.
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'super' },
      _params: { organizationId: 'org-1' },
      _body: { status: 'suspended' },
      logger: FAKE_LOGGER,
    });
    const res = await transitionOrgStatus(ctx);
    expect(res.status).toBe(200);
    for (const m of Object.values(mocks)) m.mockRestore();
  });

  test('blocks an invalid transition (active → trial) via state machine', async () => {
    const mocks = stubRepo(OrganizationRepository, {
      findById: async () => ({ id: 'org-1', status: 'active', updatedAt: new Date() }),
    });
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      session: { id: 's1', userId: 'admin-1', user: { id: 'admin-1' } },
      // FIX-001: transitionOrgStatus is super-only.
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'super' },
      _params: { organizationId: 'org-1' },
      _body: { status: 'trial' },
      logger: FAKE_LOGGER,
    });
    await expect(transitionOrgStatus(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    for (const m of Object.values(mocks)) m.mockRestore();
  });

  test('blocks reactivation more than 90 days after cancellation', async () => {
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
    const mocks = stubRepo(OrganizationRepository, {
      findById: async () => ({ id: 'org-1', status: 'cancelled', updatedAt: oldDate }),
    });
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      session: { id: 's1', userId: 'admin-1', user: { id: 'admin-1' } },
      // FIX-001: transitionOrgStatus is super-only.
      platformAdmin: { id: 'pa-1', userId: 'admin-1', role: 'super' },
      _params: { organizationId: 'org-1' },
      _body: { status: 'active' },
      logger: FAKE_LOGGER,
    });
    await expect(transitionOrgStatus(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
    for (const m of Object.values(mocks)) m.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AC-M03-006: MFA Mandatory for Admins (real platformAdminAuthMiddleware)
//
// HONEST GAP — G5: MFA is NOT enforced in production today. These tests assert
// the REAL current behavior (a non-MFA admin is admitted by the middleware) so
// the suite is not fake-green. The spec (M3-R7 / AC-M03-006) requires rejection;
// that fix is gated (Better-Auth twoFactor wiring, Batch B/E) and tracked in the
// fix report §9 Remaining Gaps. Flip the `[GAP]` test to expect rejection once
// G5 lands.
// ---------------------------------------------------------------------------

describe('[AC-M03-006] MFA Mandatory (real platformAdminAuthMiddleware)', () => {
  let mocks: Record<string, { mockRestore: () => void }>;

  function makeMwCtx(overrides: Record<string, any> = {}) {
    const vars: Record<string, any> = {
      user: { id: 'user-1', role: 'user' },
      database: {},
      ...overrides,
    };
    return {
      get: (key: string) => vars[key],
      set: (key: string, val: any) => { vars[key] = val; },
      req: { header: () => null },
    } as any;
  }

  const nonMfaAdmin = {
    id: 'pa-1',
    userId: 'user-1',
    email: 'admin@example.com',
    name: 'Admin No MFA',
    role: 'super',
    // NOTE: no twoFactorEnabled / mfaEnabled — the schema has no such field today
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  afterEach(() => {
    if (mocks) for (const m of Object.values(mocks)) m.mockRestore();
  });

  test('admits a platform admin with no MFA — passes through (current real behavior)', async () => {
    // [GAP G5] Spec M3-R7 requires this to be REJECTED. It is not, today.
    mocks = stubRepo(PlatformAdminRepository, { findByUserId: async () => nonMfaAdmin });
    const mw = platformAdminAuthMiddleware();
    const ctx = makeMwCtx({ user: { id: 'user-1', role: 'user' } });
    let nextCalled = false;
    await mw(ctx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(true); // GAP: should be false (403) once MFA is enforced
    expect(ctx.get('platformAdmin')).toEqual(nonMfaAdmin);
    for (const m of Object.values(mocks)) m.mockRestore();
  });

  test('rejects a user who is not a platform admin at all', async () => {
    mocks = stubRepo(PlatformAdminRepository, { findByUserId: async () => undefined });
    const mw = platformAdminAuthMiddleware();
    const ctx = makeMwCtx({ user: { id: 'regular-user', role: 'user' } });
    await expect(mw(ctx, async () => {})).rejects.toBeInstanceOf(ForbiddenError);
    for (const m of Object.values(mocks)) m.mockRestore();
  });

  test('rejects when there is no authenticated user', async () => {
    const mw = platformAdminAuthMiddleware();
    const ctx = makeMwCtx({ user: undefined });
    await expect(mw(ctx, async () => {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// AC-M03-007: Impersonation Write Block (real impersonationWriteBlock)
// ---------------------------------------------------------------------------

describe('[AC-M03-007] Impersonation Write Block (real impersonation-guard)', () => {
  beforeEach(() => {
    restoreRepo(ImpersonationSessionRepository);
  });

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    test(`blocks ${method} when impersonation is active (403)`, async () => {
      stubRepo(ImpersonationSessionRepository, { findByToken: async () => activeImpSession });
      const app = createImpApp();
      const path = method === 'POST' ? '/test' : '/test/1';
      const res = await app.request(path, {
        method,
        headers: { Cookie: 'memberry-imp-token=valid-token' },
      });
      expect(res.status).toBe(403);
    });
  }

  test('allows GET when impersonation is active', async () => {
    stubRepo(ImpersonationSessionRepository, { findByToken: async () => activeImpSession });
    const app = createImpApp();
    const res = await app.request('/test', {
      headers: { Cookie: 'memberry-imp-token=valid-token' },
    });
    expect(res.status).toBe(200);
  });

  test('allows POST when there is no impersonation cookie', async () => {
    const app = createImpApp();
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(201);
  });

  test('allows POST when the impersonation session has ended', async () => {
    stubRepo(ImpersonationSessionRepository, {
      findByToken: async () => ({ ...activeImpSession, endedAt: new Date() }),
    });
    const app = createImpApp();
    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: 'memberry-imp-token=valid-token' },
    });
    expect(res.status).toBe(201);
  });
});
