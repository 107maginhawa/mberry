/**
 * Tests for health check endpoints (health.ts)
 *
 * Strategy: build a minimal Hono app, register the health routes via
 * registerRoutes(), and exercise them with app.request().  All external
 * dependencies (DB, storage, jobs) are stubbed inline — no real connections.
 */

import { describe, test, expect, mock, afterAll } from 'bun:test';
import { Hono } from 'hono';

// Mock-Classification: APPROPRIATE — health check with external dependency probes
// ---------------------------------------------------------------------------
// Stub external modules before importing health.ts
// ---------------------------------------------------------------------------

// Bun's `mock.module` is process-wide — to avoid leaking the stub into
// other test files (e.g. database.test.ts that tests the real
// `detectDialect`), import the real module, spread it, then override
// only what this file needs, and restore the real module in afterAll.
const realDatabase = await import('@/core/database');

await mock.module('@/core/database', () => ({
  ...realDatabase,
  checkDatabaseConnection: mock(async () => true),
}));

afterAll(async () => {
  await mock.module('@/core/database', () => realDatabase);
});

// ---------------------------------------------------------------------------
// Import after stubbing
// ---------------------------------------------------------------------------

import { registerRoutes } from './health';
import { checkDatabaseConnection } from '@/core/database';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type HealthApp = Hono<{ Variables: any }>;

/**
 * Build a Hono app with health routes attached, injecting controllable
 * dependency stubs via app properties (matching the App type shape).
 */
function buildApp({
  dbHealthy = true,
  storageHealthy = true,
  jobsHealthy = true,
  dbHang = false,
  storageHang = false,
  jobsHang = false,
  checkTimeoutMs,
}: {
  dbHealthy?: boolean;
  storageHealthy?: boolean;
  jobsHealthy?: boolean;
  dbHang?: boolean;
  storageHang?: boolean;
  jobsHang?: boolean;
  checkTimeoutMs?: number;
} = {}): HealthApp {
  const app = new Hono() as any;

  // A promise that never settles — simulates an unreachable dependency whose
  // health probe hangs (e.g. DB pool can't acquire a connection).
  const hang = () => new Promise<never>(() => {});

  // DB health is controlled via the mocked checkDatabaseConnection
  (checkDatabaseConnection as ReturnType<typeof mock>).mockImplementation(
    dbHang ? hang : async () => dbHealthy
  );

  // Minimal stubs for storage and jobs
  app.storage = {
    healthCheck: mock(storageHang ? hang : async () => storageHealthy),
  };

  app.jobs = {
    getHealth: mock(jobsHang ? hang : async () => ({ healthy: jobsHealthy })),
  };

  app.logger = {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    child: mock(function () { return this; }),
  };

  // registerRoutes reads these properties directly off the app object
  // and also calls app.get() — so app must be the Hono instance
  app.database = {}; // passed to checkDatabaseConnection

  registerRoutes(app, checkTimeoutMs !== undefined ? { checkTimeoutMs } : {});
  return app;
}

// ---------------------------------------------------------------------------
// /livez
// ---------------------------------------------------------------------------

describe('/livez', () => {
  test('returns 200 with plain text "ok" by default', async () => {
    const app = buildApp();
    const res = await app.request('/livez');

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('ok');
  });

  test('Content-Type is text/plain for default response', async () => {
    const app = buildApp();
    const res = await app.request('/livez');
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
  });

  test('verbose=true returns JSON with status:pass', async () => {
    const app = buildApp();
    const res = await app.request('/livez?verbose');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pass');
    expect(body.checks).toBeDefined();
    expect(body.checks.ping).toBe('pass');
  });

  test('verbose response includes a timestamp', async () => {
    const app = buildApp();
    const res = await app.request('/livez?verbose');
    const body = await res.json();
    expect(typeof body.timestamp).toBe('string');
    // Must be a parseable ISO date
    expect(isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  test('verbose Content-Type is application/health+json', async () => {
    const app = buildApp();
    const res = await app.request('/livez?verbose');
    expect(res.headers.get('content-type')).toMatch(/application\/health\+json/);
  });

  test('/livez does NOT check external dependencies', async () => {
    // Even when the db stub would return false, livez should stay 200
    const app = buildApp({ dbHealthy: false, storageHealthy: false, jobsHealthy: false });
    const res = await app.request('/livez');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// /readyz — all healthy
// ---------------------------------------------------------------------------

describe('/readyz — all healthy', () => {
  test('returns 200 with plain text "ok"', async () => {
    const app = buildApp();
    const res = await app.request('/readyz');

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('ok');
  });

  test('verbose response has status:pass', async () => {
    const app = buildApp();
    const res = await app.request('/readyz?verbose');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pass');
  });

  test('verbose response lists all checks as pass', async () => {
    const app = buildApp();
    const res = await app.request('/readyz?verbose');
    const body = await res.json();

    expect(body.checks.database).toBe('pass');
    expect(body.checks.storage).toBe('pass');
    expect(body.checks.jobs).toBe('pass');
  });

  test('verbose response includes a timestamp', async () => {
    const app = buildApp();
    const res = await app.request('/readyz?verbose');
    const body = await res.json();
    expect(isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  test('verbose Content-Type is application/health+json', async () => {
    const app = buildApp();
    const res = await app.request('/readyz?verbose');
    expect(res.headers.get('content-type')).toMatch(/application\/health\+json/);
  });
});

// ---------------------------------------------------------------------------
// /readyz — partial failures
// ---------------------------------------------------------------------------

describe('/readyz — database down', () => {
  test('returns 503', async () => {
    const app = buildApp({ dbHealthy: false });
    const res = await app.request('/readyz');
    expect(res.status).toBe(503);
  });

  test('plain body is "failed"', async () => {
    const app = buildApp({ dbHealthy: false });
    const res = await app.request('/readyz');
    expect(await res.text()).toBe('failed');
  });

  test('verbose shows database:fail, storage:pass, jobs:pass', async () => {
    const app = buildApp({ dbHealthy: false });
    const res = await app.request('/readyz?verbose');
    const body = await res.json();

    expect(body.status).toBe('fail');
    expect(body.checks.database).toBe('fail');
    expect(body.checks.storage).toBe('pass');
    expect(body.checks.jobs).toBe('pass');
  });
});

describe('/readyz — storage down', () => {
  test('returns 503', async () => {
    const app = buildApp({ storageHealthy: false });
    const res = await app.request('/readyz');
    expect(res.status).toBe(503);
  });

  test('verbose shows storage:fail while others pass', async () => {
    const app = buildApp({ storageHealthy: false });
    const res = await app.request('/readyz?verbose');
    const body = await res.json();

    expect(body.status).toBe('fail');
    expect(body.checks.database).toBe('pass');
    expect(body.checks.storage).toBe('fail');
    expect(body.checks.jobs).toBe('pass');
  });
});

describe('/readyz — jobs down', () => {
  test('returns 503', async () => {
    const app = buildApp({ jobsHealthy: false });
    const res = await app.request('/readyz');
    expect(res.status).toBe(503);
  });

  test('verbose shows jobs:fail while others pass', async () => {
    const app = buildApp({ jobsHealthy: false });
    const res = await app.request('/readyz?verbose');
    const body = await res.json();

    expect(body.status).toBe('fail');
    expect(body.checks.database).toBe('pass');
    expect(body.checks.storage).toBe('pass');
    expect(body.checks.jobs).toBe('fail');
  });
});

describe('/readyz — all dependencies down', () => {
  test('returns 503', async () => {
    const app = buildApp({ dbHealthy: false, storageHealthy: false, jobsHealthy: false });
    const res = await app.request('/readyz');
    expect(res.status).toBe(503);
  });

  test('verbose shows status:fail and all checks:fail', async () => {
    const app = buildApp({ dbHealthy: false, storageHealthy: false, jobsHealthy: false });
    const res = await app.request('/readyz?verbose');
    const body = await res.json();

    expect(body.status).toBe('fail');
    expect(body.checks.database).toBe('fail');
    expect(body.checks.storage).toBe('fail');
    expect(body.checks.jobs).toBe('fail');
  });
});

// ---------------------------------------------------------------------------
// /readyz — dependency hangs (must fail-fast, never block the probe)
// ---------------------------------------------------------------------------

describe('/readyz — dependency probe hangs', () => {
  test('hanging database check → 503 within the timeout, marked fail', async () => {
    const app = buildApp({ dbHang: true, checkTimeoutMs: 50 });
    const res = await app.request('/readyz?verbose');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.database).toBe('fail');
    // Other deps still report pass — only the hung one fails.
    expect(body.checks.storage).toBe('pass');
    expect(body.checks.jobs).toBe('pass');
  });

  test('hanging storage check → 503, storage marked fail', async () => {
    const app = buildApp({ storageHang: true, checkTimeoutMs: 50 });
    const res = await app.request('/readyz?verbose');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.storage).toBe('fail');
    expect(body.checks.database).toBe('pass');
  });

  test('hanging jobs check → 503, jobs marked fail', async () => {
    const app = buildApp({ jobsHang: true, checkTimeoutMs: 50 });
    const res = await app.request('/readyz?verbose');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.jobs).toBe('fail');
  });

  test('plain /readyz with a hanging dep returns "failed" 503 (does not hang)', async () => {
    const app = buildApp({ dbHang: true, checkTimeoutMs: 50 });
    const res = await app.request('/readyz');
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// Response structure contract
// ---------------------------------------------------------------------------

describe('response structure contract', () => {
  test('/readyz verbose response always has status, timestamp, checks', async () => {
    const app = buildApp();
    const res = await app.request('/readyz?verbose');
    const body = await res.json();

    expect(Object.keys(body)).toContain('status');
    expect(Object.keys(body)).toContain('timestamp');
    expect(Object.keys(body)).toContain('checks');
    expect(Object.keys(body.checks)).toEqual(
      expect.arrayContaining(['database', 'storage', 'jobs'])
    );
  });

  test('/livez verbose response always has status, timestamp, checks', async () => {
    const app = buildApp();
    const res = await app.request('/livez?verbose');
    const body = await res.json();

    expect(Object.keys(body)).toContain('status');
    expect(Object.keys(body)).toContain('timestamp');
    expect(Object.keys(body)).toContain('checks');
    expect(Object.keys(body.checks)).toContain('ping');
  });
});
