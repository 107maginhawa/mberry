import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { OfficerTermRepository } from './repos/governance.repo';
import { auditAction } from '@/utils/audit';

/**
 * createOfficerTerm
 *
 * Path: POST /association/member/officer-terms
 * OperationId: createOfficerTerm
 */
export async function createOfficerTerm(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OfficerTermRepository(db, logger);

  const term = await repo.create({
    orgId,
    positionId: body.positionId,
    personId: body.personId,
    organizationId: body.organizationId,
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
