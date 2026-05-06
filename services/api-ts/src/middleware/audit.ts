/**
 * Global audit middleware for automatic write operation logging.
 *
 * After-middleware pattern: calls next() first so business logic runs,
 * then captures method/path/status to produce an audit entry.
 *
 * Only POST/PUT/PATCH/DELETE requests are logged. GET/HEAD/OPTIONS are skipped.
 * Audit failures are caught and logged — the middleware NEVER blocks or rethrows.
 */

import type { Context, Next } from 'hono';
import type { Variables } from '@/types/app';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const METHOD_TO_ACTION: Record<string, 'create' | 'update' | 'delete'> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/**
 * Factory that returns the Hono after-middleware.
 * Register once in app.ts after createDependencyInjection() so that
 * ctx.get('audit') is populated before this middleware runs.
 */
export function createAuditMiddleware() {
  return async (ctx: Context<{ Variables: Variables }>, next: Next): Promise<void> => {
    // Run business logic first — this is an after-middleware
    await next();

    const method = ctx.req.method.toUpperCase();

    // Skip read-only requests
    if (!WRITE_METHODS.has(method)) return;

    // Guard: audit service must be available
    const audit = ctx.get('audit');
    if (!audit) return;

    const logger = ctx.get('logger');
    const user = ctx.get('user') as { id?: string } | undefined;

    // Extract resource info from URL path
    const url = new URL(ctx.req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const resourceType = segments[0] ?? 'unknown';
    const resourceId = segments[1] ?? 'unknown';

    const action = METHOD_TO_ACTION[method] ?? 'create';

    // Derive outcome from HTTP status
    const status = ctx.res.status;
    const outcome: 'success' | 'failure' =
      status >= 200 && status < 300 ? 'success' : 'failure';

    try {
      await audit.logEvent({
        eventType: 'data-modification',
        category: 'association',
        action,
        outcome,
        user: user?.id,
        userType: (user ? 'client' : 'system') as 'client' | 'system',
        resourceType,
        resource: resourceId,
        description: `${method} ${url.pathname}`,
        ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip'),
        userAgent: ctx.req.header('user-agent'),
      });
    } catch (error) {
      logger?.error({ error }, 'Audit middleware failed to log event');
    }
  };
}
