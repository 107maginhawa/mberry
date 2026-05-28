import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { UpdateInstitutionalMembershipBody, UpdateInstitutionalMembershipParams } from '@/generated/openapi/validators';
import { InstitutionalMembershipRepository } from './repos/institutional-membership.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * updateInstitutionalMembership
 *
 * Path: PATCH /association/member/institutional-memberships/{institutionalMembershipId}
 * OperationId: updateInstitutionalMembership
 */
export async function updateInstitutionalMembership(
  ctx: ValidatedContext<UpdateInstitutionalMembershipBody, never, UpdateInstitutionalMembershipParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new InstitutionalMembershipRepository(db, logger);

  const existing = await repo.findOneById(params.institutionalMembershipId);
  if (!existing) throw new NotFoundError('Institutional membership');

  // Validate seat reduction constraint
  if (body.totalSeats !== undefined && body.totalSeats < existing.usedSeats) {
    throw new BusinessLogicError('Cannot reduce seats below used count', 'SEATS_BELOW_USED');
  }

  const updated = await repo.updateOneById(params.institutionalMembershipId, {
    ...body,
    updatedAt: new Date(),
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'institutionalMembership',
    resourceId: params.institutionalMembershipId,
    description: 'Institutional membership updated',
  });

  return ctx.json(updated, 200);
}
