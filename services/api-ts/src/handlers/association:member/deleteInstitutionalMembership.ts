import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { DeleteInstitutionalMembershipParams } from '@/generated/openapi/validators';
import { InstitutionalMembershipRepository, SeatAllocationRepository } from './repos/institutional-membership.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * deleteInstitutionalMembership
 *
 * Path: DELETE /association/member/institutional-memberships/{institutionalMembershipId}
 * OperationId: deleteInstitutionalMembership
 */
export async function deleteInstitutionalMembership(
  ctx: ValidatedContext<never, never, DeleteInstitutionalMembershipParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new InstitutionalMembershipRepository(db, logger);
  const seatRepo = new SeatAllocationRepository(db, logger);

  const existing = await repo.findOneById(params.institutionalMembershipId);
  if (!existing) throw new NotFoundError('Institutional membership');

  // Cascade: revoke all active seat allocations
  await seatRepo.revokeAllActive(params.institutionalMembershipId);

  // Soft-delete: set status to 'removed'
  await repo.updateOneById(params.institutionalMembershipId, {
    status: 'removed',
    updatedAt: new Date(),
  });

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'institutionalMembership',
    resourceId: params.institutionalMembershipId,
    description: 'Institutional membership removed (soft-delete); all active seats revoked',
  });

  return ctx.json({ success: true }, 200);
}
