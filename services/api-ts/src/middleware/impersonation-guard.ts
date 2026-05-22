/**
 * Impersonation write-block middleware.
 *
 * When an admin is impersonating a user (detected via HTTP-only cookie),
 * all mutating requests (POST/PUT/PATCH/DELETE) are blocked with 403.
 * GET/HEAD/OPTIONS pass through for read-only viewing.
 *
 * Flow:
 * 1. Auth middleware reads `memberry-imp-token` cookie
 * 2. Resolves token → ImpersonationSession (validates expiry + not ended)
 * 3. Sets `impersonationSession` in Hono context
 * 4. This middleware checks context and blocks writes
 */

import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { ForbiddenError } from '@/core/errors';
import { ImpersonationSessionRepository } from '@/handlers/platformadmin/repos/platform-admin.repo';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MAX_IMPERSONATION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Resolves the impersonation cookie and populates context.
 * Must run after dependency injection middleware (needs database).
 */
export function impersonationResolver() {
  return async (ctx: Context, next: Next) => {
    const token = getCookie(ctx, 'memberry-imp-token');

    if (token) {
      const db = ctx.get('database');
      const logger = ctx.get('logger');
      const repo = new ImpersonationSessionRepository(db, logger);
      const session = await repo.findByToken(token);

      if (
        session &&
        !session.endedAt &&
        session.expiresAt > new Date() &&
        Date.now() - session.createdAt.getTime() <= MAX_IMPERSONATION_DURATION_MS
      ) {
        ctx.set('impersonationSession', {
          id: session.id,
          adminId: session.adminId,
          targetUserId: session.targetUserId,
          targetOrgId: session.targetOrgId,
          expiresAt: session.expiresAt,
        });
      }
      // Expired or ended token: silently ignore (cookie will expire naturally)
    }

    await next();
  };
}

/**
 * Blocks mutating requests when impersonation session is active.
 * Returns 403 with clear message indicating read-only mode.
 */
export function impersonationWriteBlock() {
  return async (ctx: Context, next: Next) => {
    const impSession = ctx.get('impersonationSession');

    if (impSession && !READ_ONLY_METHODS.has(ctx.req.method)) {
      throw new ForbiddenError(
        'Write operations are blocked during impersonation. End the impersonation session to make changes.',
      );
    }

    await next();
  };
}
