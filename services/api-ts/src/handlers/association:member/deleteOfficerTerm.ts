import type { ValidatedContext } from '@/types/app';
import type { BetterAuthInternalApi } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { OfficerTermRepository } from './repos/governance.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

/**
 * deleteOfficerTerm
 *
 * Path: DELETE /association/member/officer-terms/{termId}
 * OperationId: deleteOfficerTerm
 *
 * M4-R2: President-only authorization for role changes.
 */
export async function deleteOfficerTerm(
  ctx: ValidatedContext<never, never, { termId: string }>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { termId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'association:member' }) ?? baseLogger;
  const repo = new OfficerTermRepository(db, logger);

  const existing = await repo.findById(termId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Officer term');
  }

  await repo.delete(termId);

  ctx.set('auditResourceId', termId);
  ctx.set('auditDescription', 'Officer term deleted');

  domainEvents.emit('officer.removed', {
    termId,
    personId: existing.personId,
    positionId: existing.positionId,
    organizationId: orgId,
    removedBy: user.id,
  }).catch(() => {});

  // P1-4: Invalidate removed officer's sessions so they re-authenticate without officer role
  try {
    const auth = ctx.get('auth');
    if (auth && existing.personId) {
      await (auth.api as unknown as BetterAuthInternalApi).revokeUserSessions({
        body: { userId: existing.personId },
        headers: ctx.req.raw.headers,
      });
      logger?.info({ action: 'deleteOfficerTerm.1', personId: existing.personId, termId }, 'Sessions revoked after officer term deletion');
    }
  } catch (err) {
    logger?.warn({ action: 'deleteOfficerTerm.2', error: err, personId: existing.personId }, 'Failed to revoke sessions after officer term deletion');
  }

  return ctx.json({ success: true });
}
