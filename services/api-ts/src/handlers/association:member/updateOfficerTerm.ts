import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { OfficerTermRepository } from './repos/governance.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateOfficerTerm
 *
 * Path: PATCH /association/member/officer-terms/{termId}
 * OperationId: updateOfficerTerm
 */
export async function updateOfficerTerm(
  ctx: ValidatedContext<any, never, { termId: string }>
): Promise<Response> {
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

  const updated = await repo.update(termId, body);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'officer-term',
    resourceId: termId,
    description: 'Officer term updated',
  });

  // P1-4: Invalidate affected user's sessions so they re-authenticate with updated role
  try {
    const auth = ctx.get('auth');
    if (auth && existing.personId) {
      await (auth.api as any).revokeUserSessions({
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
