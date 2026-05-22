/**
 * P1-5: Global rate limiter middleware for custom (non-auth) endpoints.
 *
 * In-memory sliding window per IP. Better-Auth already handles rate limiting
 * for /auth/* routes — this covers everything else.
 *
 * Limits:
 *   - Write ops (POST/PUT/PATCH/DELETE): 30 req/min per IP
 *   - Read ops (GET/HEAD/OPTIONS):      120 req/min per IP
 */

import type { Context, Next } from 'hono';
import { RateLimitError } from '@/core/errors';

interface RateLimitEntry {
  timestamps: number[];
}

const WRITE_LIMIT = 30;
const READ_LIMIT = 120;
const WINDOW_MS = 60_000; // 1 minute
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes

const writeBuckets = new Map<string, RateLimitEntry>();
const readBuckets = new Map<string, RateLimitEntry>();

// Periodic cleanup of stale entries to prevent memory leaks
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    for (const [key, entry] of writeBuckets) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) writeBuckets.delete(key);
    }
    for (const [key, entry] of readBuckets) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) readBuckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't hold the process open for cleanup
  if (cleanupTimer.unref) cleanupTimer.unref();
}

function getClientIp(ctx: Context): string {
  return (
    ctx.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    ctx.req.header('x-real-ip') ||
    ctx.req.header('x-client-ip') ||
    'unknown'
  );
}

export function createRateLimiter() {
  startCleanup();

  return async (ctx: Context, next: Next) => {
    // Skip rate limiting in non-production environments to avoid false failures in integration tests
    const env = process.env['NODE_ENV'];
    if (!env || env === 'test' || env === 'development') {
      return next();
    }

    // Skip rate limiting for auth routes (Better-Auth handles those)
    if (ctx.req.path.startsWith('/auth/')) {
      return next();
    }

    // Skip health checks
    if (ctx.req.path === '/health' || ctx.req.path === '/ready') {
      return next();
    }

    const ip = getClientIp(ctx);
    const method = ctx.req.method.toUpperCase();
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const buckets = isWrite ? writeBuckets : readBuckets;
    const limit = isWrite ? WRITE_LIMIT : READ_LIMIT;
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    let entry = buckets.get(ip);
    if (!entry) {
      entry = { timestamps: [] };
      buckets.set(ip, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);

    if (entry.timestamps.length >= limit) {
      const oldestInWindow = entry.timestamps[0] ?? now;
      const retryAfter = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);

      ctx.header('Retry-After', String(retryAfter));
      ctx.header('X-RateLimit-Limit', String(limit));
      ctx.header('X-RateLimit-Remaining', '0');
      ctx.header('X-RateLimit-Reset', String(Math.ceil((oldestInWindow + WINDOW_MS) / 1000)));

      throw new RateLimitError('Rate limit exceeded', { retryAfter });
    }

    entry.timestamps.push(now);

    // Add rate limit headers to response
    ctx.header('X-RateLimit-Limit', String(limit));
    ctx.header('X-RateLimit-Remaining', String(limit - entry.timestamps.length));

    return next();
  };
}
