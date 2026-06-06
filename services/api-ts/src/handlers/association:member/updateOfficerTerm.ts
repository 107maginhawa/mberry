import type { ValidatedContext } from '@/types/app';
import type { BetterAuthInternalApi } from '@/types/auth';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { OfficerTermRepository } from './repos/governance.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import { isValidTermTransition, termTransitionError } from './utils/status-transitions';

/**
 * updateOfficerTerm
 *
 * Path: PATCH /association/member/officer-terms/{termId}
 * OperationId: updateOfficerTerm
 *
 * M4-R2: President-only authorization for role changes.
 */
export async function updateOfficerTerm(
  ctx: ValidatedContext<any, never, { termId: string }>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { termId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OfficerTermRepository(db, logger);

  const existing = await repo.findById(termId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Officer term');
  }

  if (body.status && body.status !== existing.status) {
    if (!isValidTermTransition(existing.status, body.status)) {
      throw new BusinessLogicError(
        termTransitionError(existing.status, body.status),
        'INVALID_TERM_TRANSITION',
      );
    }
  }

  const updated = await repo.update(termId, body);

  ctx.set('auditResourceId', termId);
  ctx.set('auditDescription', 'Officer term updated');
  ctx.set('auditDetails', { previousState: { status: existing.status, notes: existing.notes, endDate: existing.endDate }, changes: body });

  // P1-4: Invalidate affected user's sessions so they re-authenticate with updated role
  try {
    const auth = ctx.get('auth');
    if (auth && existing.personId) {
      await (auth.api as unknown as BetterAuthInternalApi).revokeUserSessions({
        body: { userId: existing.personId },
        headers: ctx.req.raw.headers,
      });
      logger?.info({ personId: existing.personId, termId }, 'Sessions revoked after officer term update');
    }
  } catch (err) {
    logger?.warn({ error: err, personId: existing.personId }, 'Failed to revoke sessions after officer term update');
  }

  return ctx.json(updated);
}
