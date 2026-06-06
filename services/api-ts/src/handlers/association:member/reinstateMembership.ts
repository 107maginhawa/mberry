import type { ValidatedContext } from '@/types/app';
import type { Membership } from './repos/membership.schema';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { ReinstateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { withComputedStatus, persistWithComputedStatus } from './utils/membership-status-middleware';

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
  const enriched = withComputedStatus(membership);

  const reinstatableStatuses = ['removed', 'suspended'];
  if (!reinstatableStatuses.includes(enriched.status)) {
    throw new BusinessLogicError(
      `Cannot reinstate a membership with status '${enriched.status}'. Must be removed or suspended.`,
      'MEMBERSHIP_NOT_REINSTATABLE',
    );
  }

  const updated = await persistWithComputedStatus(db, membershipId, membership, {
    suspendedAt: null,
    removedAt: null,
  });

  // Clear removalReason (non-status field — separate update)
  await repo.updateOneById(membershipId, { removalReason: null } as Partial<Membership>);

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', 'Membership reinstated');

  return ctx.json(updated, 200);
}
