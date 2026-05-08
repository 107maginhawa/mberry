import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { OfficerTermRepository } from './repos/governance.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * createOfficerTerm
 *
 * Path: POST /association/member/officer-terms
 * OperationId: createOfficerTerm
 */
export async function createOfficerTerm(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OfficerTermRepository(db, logger);

  const term = await repo.create({
    organizationId: orgId,
    positionId: body.positionId,
    personId: body.personId,
    startDate: new Date(body.startDate),
    endDate: body.endDate ? new Date(body.endDate) : null,
    status: body.status || 'upcoming',
    notes: body.notes || null,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'officer-term',
    resourceId: term.id,
    description: 'Officer term created',
  });

  return ctx.json(term, 201);
}
