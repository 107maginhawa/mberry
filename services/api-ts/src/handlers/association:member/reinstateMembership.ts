import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { ReinstateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * reinstateMembership
 *
 * Path: POST /association/member/memberships/{membershipId}/reinstate
 * OperationId: reinstateMembership
 */
export async function reinstateMembership(
  ctx: ValidatedContext<never, never, ReinstateMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  const reinstatableStatuses = ['terminated', 'suspended'];
  if (!reinstatableStatuses.includes(membership.status)) {
    throw new BusinessLogicError(
      `Cannot reinstate a membership with status '${membership.status}'. Must be terminated or suspended.`,
      'MEMBERSHIP_NOT_REINSTATABLE',
    );
  }

  const updated = await repo.updateOneById(membershipId, {
    status: 'active',
    terminatedAt: null,
    terminationReason: null,
  } as any);

  await auditAction(ctx, {
    action: 'reinstate',
    resourceType: 'membership',
    resourceId: membershipId,
    description: 'Membership reinstated',
  });

  return ctx.json(updated, 200);
}
