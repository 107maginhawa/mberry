/**
 * Tests for the feature-flag enforcement gate (AHA FIX-009 / G2).
 *
 * Proves the DB `feature_flag` table is actually ENFORCED:
 * - a disabled module → gated 403 with { error, moduleName }
 * - an enabled module → pass
 * - no flag row → fail-open (pass)
 * - an org-specific override beats the tier/association default (precedence)
 *
 * The gate is opt-in and keyed by module name. It reads orgId from context
 * (set by org-context middleware) and resolves flags through an injected port
 * so the test stays DB-free.
 */

import { describe, test, expect } from 'bun:test';
import { Hono } from 'hono';
import { featureFlagGate, resolveFlagDecision, type FeatureFlagRecord } from './feature-flag-gate';
import type { FeatureFlagPort } from '@/core/ports/feature-flag.port';
import { AppError } from '@/core/errors';

// ─── Fixtures ────────────────────────────────────────────

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const ASSOC_ID = '22222222-2222-2222-2222-222222222222';

function flag(p: Partial<FeatureFlagRecord>): FeatureFlagRecord {
  return {
    targetType: 'org',
    targetId: ORG_ID,
    moduleName: 'marketplace',
    enabled: true,
    isOverride: false,
    ...p,
  };
}

/** Build a port that returns the given flag rows for any lookup. */
function portWith(rows: FeatureFlagRecord[]): FeatureFlagPort {
  return {
    async findEnforcementFlags(_orgId, moduleName) {
      return rows.filter((r) => r.moduleName === moduleName);
    },
  };
}

// ─── Test App Factory ───────────────────────────────────

function createTestApp(opts: {
  moduleName: string;
  port: FeatureFlagPort;
  orgId?: string | null;
}) {
  const app = new Hono();

  // Fake dependency injection + org context.
  app.use('*', async (c, next) => {
    c.set('database', {} as never);
    c.set('logger', { debug() {}, warn() {}, info() {}, error() {} } as never);
    if (opts.orgId !== null) {
      c.set('organizationId', opts.orgId ?? ORG_ID);
    }
    await next();
  });

  app.use('*', featureFlagGate(opts.moduleName, { port: opts.port }));

  app.get('/test', (c) => c.json({ ok: true }));
  app.post('/test', (c) => c.json({ created: true }, 201));

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.statusCode as never);
    }
    return c.json({ error: 'Internal error' }, 500);
  });

  return app;
}

// ─── Pure precedence logic ──────────────────────────────

describe('resolveFlagDecision precedence', () => {
  test('no rows → undefined (fail-open)', () => {
    expect(resolveFlagDecision([])).toBeUndefined();
  });

  test('single org row decides', () => {
    expect(resolveFlagDecision([flag({ enabled: false })])).toBe(false);
    expect(resolveFlagDecision([flag({ enabled: true })])).toBe(true);
  });

  test('org override beats tier default', () => {
    const rows = [
      flag({ targetType: 'tier', targetId: 'pro', enabled: true, isOverride: false }),
      flag({ targetType: 'org', targetId: ORG_ID, enabled: false, isOverride: true }),
    ];
    // Org override disabled must win over the tier-default enabled.
    expect(resolveFlagDecision(rows)).toBe(false);
  });

  test('org default beats association default', () => {
    const rows = [
      flag({ targetType: 'association', targetId: ASSOC_ID, enabled: false, isOverride: false }),
      flag({ targetType: 'org', targetId: ORG_ID, enabled: true, isOverride: false }),
    ];
    expect(resolveFlagDecision(rows)).toBe(true);
  });

  test('association beats tier when no org row', () => {
    const rows = [
      flag({ targetType: 'tier', targetId: 'pro', enabled: true, isOverride: false }),
      flag({ targetType: 'association', targetId: ASSOC_ID, enabled: false, isOverride: false }),
    ];
    expect(resolveFlagDecision(rows)).toBe(false);
  });

  test('org override beats org default row', () => {
    const rows = [
      flag({ targetType: 'org', targetId: ORG_ID, enabled: true, isOverride: false }),
      flag({ targetType: 'org', targetId: ORG_ID, enabled: false, isOverride: true }),
    ];
    expect(resolveFlagDecision(rows)).toBe(false);
  });
});

// ─── Gate middleware behavior ───────────────────────────

describe('featureFlagGate middleware', () => {
  test('disabled module → gated 403 with { error, moduleName }', async () => {
    const app = createTestApp({
      moduleName: 'marketplace',
      port: portWith([flag({ enabled: false })]),
    });
    const res = await app.request('/test');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; moduleName: string };
    expect(body.moduleName).toBe('marketplace');
    expect(body.error).toBeDefined();
  });

  test('enabled module → pass (200)', async () => {
    const app = createTestApp({
      moduleName: 'marketplace',
      port: portWith([flag({ enabled: true })]),
    });
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  test('no flag row → fail-open (pass)', async () => {
    const app = createTestApp({
      moduleName: 'marketplace',
      port: portWith([]),
    });
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  test('disabled module blocks writes too (POST 403)', async () => {
    const app = createTestApp({
      moduleName: 'marketplace',
      port: portWith([flag({ enabled: false })]),
    });
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(403);
  });

  test('org override disabled beats tier-default enabled → 403', async () => {
    const app = createTestApp({
      moduleName: 'marketplace',
      port: portWith([
        flag({ targetType: 'tier', targetId: 'pro', enabled: true, isOverride: false }),
        flag({ targetType: 'org', targetId: ORG_ID, enabled: false, isOverride: true }),
      ]),
    });
    const res = await app.request('/test');
    expect(res.status).toBe(403);
  });

  test('no org context → fail-open (pass), gate cannot scope', async () => {
    const app = createTestApp({
      moduleName: 'marketplace',
      port: portWith([flag({ enabled: false })]),
      orgId: null,
    });
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });
});

// ─── Route-walk regression ──────────────────────────────
//
// Mirrors the app.ts wiring: the gate is mounted OPT-IN on one prefix
// (`/association/marketplace/*`) keyed by module name 'marketplace'. Walks a
// set of routes to prove:
//  - the gated prefix 403s ONLY when 'marketplace' is explicitly disabled,
//  - the gated prefix passes when enabled or when no flag row exists,
//  - routes on OTHER prefixes (other modules) are never touched by the gate.

describe('featureFlagGate route-walk regression', () => {
  function createWalkApp(rows: FeatureFlagRecord[]) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('database', {} as never);
      c.set('logger', { debug() {}, warn() {}, info() {}, error() {} } as never);
      c.set('organizationId', ORG_ID);
      await next();
    });
    // OPT-IN: gate only the marketplace prefix, keyed by module name.
    app.use('/association/marketplace/*', featureFlagGate('marketplace', { port: portWith(rows) }));
    app.get('/association/marketplace/listings', (c) => c.json({ ok: true }));
    app.post('/association/marketplace/orders', (c) => c.json({ ok: true }, 201));
    // Other modules — NOT gated.
    app.get('/association/events/list', (c) => c.json({ ok: true }));
    app.get('/association/dues/dashboard', (c) => c.json({ ok: true }));
    return app;
  }

  test('marketplace disabled → only marketplace prefix 403s; other modules pass', async () => {
    const app = createWalkApp([flag({ moduleName: 'marketplace', enabled: false })]);

    expect((await app.request('/association/marketplace/listings')).status).toBe(403);
    expect((await app.request('/association/marketplace/orders', { method: 'POST' })).status).toBe(403);
    // Unrelated modules unaffected by the gate.
    expect((await app.request('/association/events/list')).status).toBe(200);
    expect((await app.request('/association/dues/dashboard')).status).toBe(200);
  });

  test('marketplace enabled → marketplace prefix passes', async () => {
    const app = createWalkApp([flag({ moduleName: 'marketplace', enabled: true })]);
    expect((await app.request('/association/marketplace/listings')).status).toBe(200);
    expect((await app.request('/association/marketplace/orders', { method: 'POST' })).status).toBe(201);
  });

  test('no marketplace flag row → fail-open, all routes pass', async () => {
    // A flag exists for a DIFFERENT module only; marketplace has no row.
    const app = createWalkApp([flag({ moduleName: 'events', enabled: false })]);
    expect((await app.request('/association/marketplace/listings')).status).toBe(200);
    expect((await app.request('/association/events/list')).status).toBe(200);
  });
});
