import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { RenewMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { withComputedStatus, persistWithComputedStatus } from './utils/membership-status-middleware';
import type { Membership } from './repos/membership.schema';
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
  const enriched = withComputedStatus(membership);

  const renewableStatuses = ['active', 'gracePeriod', 'lapsed'];
  if (!renewableStatuses.includes(enriched.status)) {
    throw new BusinessLogicError(
      `Cannot renew a membership with status '${enriched.status}'. Must be active, gracePeriod, or lapsed.`,
      'MEMBERSHIP_NOT_RENEWABLE',
    );
  }

  // Extend from current expiry date, not today
  const currentExpiry = new Date(membership.duesExpiryDate ?? new Date());
  currentExpiry.setFullYear(currentExpiry.getFullYear() + 1);
  const newExpiryDate = currentExpiry.toISOString().split('T')[0];

  const updated = await persistWithComputedStatus(db, membershipId, membership, {
    duesExpiryDate: newExpiryDate,
  });

  await auditAction(ctx, {
    action: 'renew',
    resourceType: 'membership',
    resourceId: membershipId,
    description: 'Membership renewed',
    eventSubType: 'membership.member-renewed',
  });

  return ctx.json(updated, 200);
}
