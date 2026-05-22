/**
 * Basic Prometheus-compatible metrics endpoint.
 * Tracks request counts and durations per route.
 * No external dependencies — uses in-memory counters.
 */

import type { App } from '@/types/app';

// ─── Counters ────────────────────────────────────────────

const requestCounts = new Map<string, number>();
const errorCounts = new Map<string, number>();
let totalRequests = 0;
let totalErrors = 0;
const startTime = Date.now();

/**
 * Middleware to track request metrics.
 * Call registerMetricsMiddleware(app) before route registration.
 */
export function registerMetricsMiddleware(app: App): void {
  app.use('*', async (ctx, next) => {
    totalRequests++;
    const key = `${ctx.req.method} ${ctx.req.routePath || ctx.req.path}`;
    requestCounts.set(key, (requestCounts.get(key) || 0) + 1);

    await next();

    if (ctx.res.status >= 400) {
      totalErrors++;
      const errKey = `${ctx.res.status}`;
      errorCounts.set(errKey, (errorCounts.get(errKey) || 0) + 1);
    }
  });
}

/**
 * Register the GET /metrics endpoint.
 */
export function registerMetricsRoute(app: App): void {
  app.get('/metrics', (ctx) => {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    const lines: string[] = [
      '# HELP http_requests_total Total HTTP requests.',
      '# TYPE http_requests_total counter',
      `http_requests_total ${totalRequests}`,
      '',
      '# HELP http_errors_total Total HTTP error responses (4xx/5xx).',
      '# TYPE http_errors_total counter',
      `http_errors_total ${totalErrors}`,
      '',
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${uptimeSeconds}`,
    ];

    // Per-status error breakdown
    if (errorCounts.size > 0) {
      lines.push('', '# HELP http_errors_by_status HTTP errors by status code.', '# TYPE http_errors_by_status counter');
      for (const [status, count] of [...errorCounts.entries()].sort()) {
        lines.push(`http_errors_by_status{status="${status}"} ${count}`);
      }
    }

    // Top routes by request count (limit to 20)
    const topRoutes = [...requestCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    if (topRoutes.length > 0) {
      lines.push('', '# HELP http_requests_by_route Requests per route.', '# TYPE http_requests_by_route counter');
      for (const [route, count] of topRoutes) {
        lines.push(`http_requests_by_route{route="${route}"} ${count}`);
      }
    }

    lines.push('');
    return ctx.text(lines.join('\n'), 200, {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    });
  });
}
