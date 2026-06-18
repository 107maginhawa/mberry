/**
 * Health check endpoints for Kubernetes liveness and readiness probes
 * Provides standardized health endpoints following Kubernetes conventions
 */

import type { App } from '@/types/app';
import { checkDatabaseConnection } from '@/core/database';

/**
 * Default per-dependency probe timeout for /readyz. A readiness probe must
 * never hang: if a dependency check (DB pool acquire, storage HEAD, jobs poll)
 * blocks, we treat it as unhealthy and return 503 so orchestrators can route
 * traffic away instead of waiting indefinitely.
 */
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 3000;

/**
 * Resolve `p` normally, but if it neither resolves nor rejects within `ms`,
 * resolve to `fallback`. A rejection also yields `fallback` (caller treats it
 * as a failed check). Never rejects.
 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    void Promise.resolve(p).then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

/**
 * Register health check endpoints with the Hono app
 * Implements Kubernetes-compliant health check endpoints
 */
export function registerRoutes(app: App, opts: { checkTimeoutMs?: number } = {}): void {
  const { database, storage, jobs, logger } = app;
  const checkTimeoutMs = opts.checkTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;

  // Liveness probe - simple "is app alive?" check
  app.get('/livez', async (ctx) => {
    // Lightweight check - just verify the app process is running
    // No external dependency checks to avoid false negatives
    const isVerbose = ctx.req.query('verbose') !== undefined;
    
    if (isVerbose) {
      // RFC-compliant verbose response
      return ctx.json({
        status: 'pass',
        timestamp: new Date().toISOString(),
        checks: {
          ping: 'pass'
        }
      }, 200, {
        'Content-Type': 'application/health+json'
      });
    }
    
    // Kubernetes standard: simple text response
    ctx.header('Content-Type', 'text/plain');
    return ctx.text('ok', 200);
  });

  // Readiness probe - comprehensive "can app serve traffic?" check
  app.get('/readyz', async (ctx) => {
    // Run probes in parallel, each bounded by a timeout. A hung dependency
    // resolves to its "unhealthy" fallback instead of blocking the response.
    const [dbHealthy, storageHealthy, jobsHealth] = await Promise.all([
      withTimeout(
        Promise.resolve().then(() => checkDatabaseConnection(database, logger)),
        checkTimeoutMs,
        false,
      ),
      withTimeout(
        Promise.resolve().then(() => storage.healthCheck()),
        checkTimeoutMs,
        false,
      ),
      withTimeout(
        Promise.resolve().then(() => jobs.getHealth()),
        checkTimeoutMs,
        { healthy: false },
      ),
    ]);
    const jobsHealthy = jobsHealth.healthy;
    
    const allHealthy = dbHealthy && storageHealthy && jobsHealthy;
    const isVerbose = ctx.req.query('verbose') !== undefined;
    
    if (isVerbose) {
      // RFC-compliant verbose response
      return ctx.json({
        status: allHealthy ? 'pass' : 'fail',
        timestamp: new Date().toISOString(),
        checks: {
          database: dbHealthy ? 'pass' : 'fail',
          storage: storageHealthy ? 'pass' : 'fail',
          jobs: jobsHealthy ? 'pass' : 'fail',
        }
      }, allHealthy ? 200 : 503, {
        'Content-Type': 'application/health+json'
      });
    }
    
    // Kubernetes standard: simple text response
    ctx.header('Content-Type', 'text/plain');
    return ctx.text(allHealthy ? 'ok' : 'failed', allHealthy ? 200 : 503);
  });

}