import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { RenewMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * renewMembership
 *
 * Path: POST /association/member/memberships/{membershipId}/renew
 * OperationId: renewMembership
 */
export async function renewMembership(
  ctx: ValidatedContext<never, never, RenewMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  const renewableStatuses = ['active', 'gracePeriod', 'lapsed'];
  if (!renewableStatuses.includes(membership.status)) {
    throw new BusinessLogicError(
      `Cannot renew a membership with status '${membership.status}'. Must be active, gracePeriod, or lapsed.`,
      'MEMBERSHIP_NOT_RENEWABLE',
    );
  }

  // Extend from current expiry date, not today
  const currentExpiry = new Date(membership.duesExpiryDate ?? new Date());
  currentExpiry.setFullYear(currentExpiry.getFullYear() + 1);
  const newExpiryDate = currentExpiry.toISOString().split('T')[0];

  const updated = await repo.updateOneById(membershipId, {
    duesExpiryDate: newExpiryDate,
    status: 'active',
  } as any);

  await auditAction(ctx, {
    action: 'renew',
    resourceType: 'membership',
    resourceId: membershipId,
    description: 'Membership renewed',
  });

  return ctx.json(updated, 200);
}
