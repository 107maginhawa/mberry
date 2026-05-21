import { deleteCookie } from 'hono/cookie';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { EndImpersonationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { ImpersonationSessionRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

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

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'impersonation-session',
    resourceId: sessionId,
    description: `Impersonation session ended for target user ${impSession.targetUserId}`,
  });

  return ctx.json(ended, 200);
}