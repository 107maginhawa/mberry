import { deleteCookie } from 'hono/cookie';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { EndImpersonationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { ImpersonationSessionRepository } from './repos/platform-admin.repo';
import { domainEvents } from '@/core/domain-events';
import { requireAdminTier, SUPPORT_OR_SUPER } from '@/core/auth/admin-tier';

/**
 * endImpersonation
 *
 * Path: POST /admin/impersonate/{sessionId}/end
 * OperationId: endImpersonation
 */
export async function endImpersonation(
  ctx: ValidatedContext<never, never, EndImpersonationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  // FIX-008 (G1) / Q8: ending an impersonation session is a support-or-super
  // action; analyst is read-only and cannot start or end impersonation.
  const denied = requireAdminTier(ctx, SUPPORT_OR_SUPER);
  if (denied) return denied;

  const { sessionId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new ImpersonationSessionRepository(db, logger);

  const impSession = await repo.findById(sessionId);
  if (!impSession) {
    throw new NotFoundError('Impersonation session not found');
  }

  const ended = await repo.end(sessionId);

  // Clear the impersonation cookie
  deleteCookie(ctx, 'memberry-imp-token', { path: '/' });

  ctx.set('auditResourceId', sessionId);
  ctx.set('auditDescription', `Impersonation session ended for target user ${impSession.targetUserId}`);

  // [EM-M03-d1e2f3a4] Emit spec-declared ImpersonationEnded event.
  domainEvents
    .emit('impersonation.ended', {
      sessionId,
      adminId: impSession.adminId,
      targetUserId: impSession.targetUserId,
    })
    .catch(() => {});

  return ctx.json(ended, 200);
}