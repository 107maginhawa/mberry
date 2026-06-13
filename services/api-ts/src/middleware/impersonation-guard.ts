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
 *
 * S-C4-014 (Wave G2): session lookup goes through `core/ports` instead of
 * importing `ImpersonationSessionRepository` directly.
 */

import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { ForbiddenError } from '@/core/errors';
import { getImpersonationPort, type ImpersonationPort } from '@/core/ports';

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MAX_IMPERSONATION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface ImpersonationResolverDeps {
  /**
   * Optional override for the impersonation port. When omitted, the
   * middleware resolves the production adapter from `core/ports`.
   */
  impersonationPort?: ImpersonationPort;
}

/**
 * Resolves the impersonation cookie and populates context.
 * Must run after dependency injection middleware (needs database).
 */
export function impersonationResolver(deps: ImpersonationResolverDeps = {}) {
  return async (ctx: Context, next: Next) => {
    const token = getCookie(ctx, 'memberry-imp-token');

    if (token) {
      const db = ctx.get('database');
      const logger = ctx.get('logger');
      const port = deps.impersonationPort ?? (await getImpersonationPort(db, logger));
      const session = await port.findByToken(token);

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
 * Per-request navigation audit under active impersonation (FIX-016 / M3-R2).
 *
 * The spec (M3-R2) promises that *every* read/navigation performed while an
 * admin is impersonating a user is logged — not only session start/end. This
 * middleware emits one `data-access` audit entry per read-only request when an
 * impersonation session is active, carrying BOTH the acting admin id and the
 * impersonated target id so the trail can answer "who actually viewed this".
 *
 * Scope (read-only console, Q3 V1 decision):
 * - Only GET/HEAD/OPTIONS are audited here; writes are blocked by
 *   `impersonationWriteBlock` and never reach a handler.
 * - Must run AFTER `impersonationResolver` (needs `impersonationSession`) and
 *   may run before `impersonationWriteBlock` (writes carry no read entry).
 *
 * Fire-and-forget: audit failures are swallowed (logged) and never affect the
 * response, matching `core/audit/audit-action.ts` semantics. Additive only —
 * does not alter auth or normal request flow.
 */
export function impersonationReadAudit() {
  return async (ctx: Context, next: Next) => {
    const impSession = ctx.get('impersonationSession');

    if (impSession && READ_ONLY_METHODS.has(ctx.req.method)) {
      const audit = ctx.get('audit');
      if (audit) {
        const logger = ctx.get('logger');
        const path = (() => {
          try {
            return new URL(ctx.req.url).pathname;
          } catch {
            return ctx.req.path;
          }
        })();
        try {
          await audit.logEvent({
            eventType: 'data-access',
            eventSubType: 'authentication.impersonation-read',
            category: 'security',
            action: 'read',
            outcome: 'success',
            organizationId: impSession.targetOrgId ?? undefined,
            user: impSession.adminId,
            userType: 'admin',
            resourceType: 'impersonation-navigation',
            resource: impSession.id,
            description: `Admin ${impSession.adminId} viewed ${ctx.req.method} ${path} while impersonating user ${impSession.targetUserId}`,
            details: {
              adminId: impSession.adminId,
              targetUserId: impSession.targetUserId,
              targetOrgId: impSession.targetOrgId,
              method: ctx.req.method,
              path,
            },
            ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip'),
            userAgent: ctx.req.header('user-agent'),
          });
        } catch (error) {
          logger?.error?.({ error, impersonationSessionId: impSession.id }, 'Failed to log impersonation read audit');
        }
      }
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
