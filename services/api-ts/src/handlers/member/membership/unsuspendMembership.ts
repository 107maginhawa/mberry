import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { UnsuspendMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { withComputedStatus, persistWithComputedStatus } from './utils/membership-status-middleware';
import { assertRecordInCallerOrg } from './utils/assert-record-org';

/**
 * unsuspendMembership
 *
 * FIX-009 / decision #1: the dedicated inverse of suspend. It is the ONLY exit
 * from `suspended` (reinstate no longer accepts suspended). Clearing suspendedAt
 * lets the computed status fall back to its dues-derived value (active /
 * gracePeriod / lapsed).
 *
 * Path: POST /association/member/memberships/{membershipId}/unsuspend
 * OperationId: unsuspendMembership
 */
export async function unsuspendMembership(
  ctx: ValidatedContext<never, never, UnsuspendMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');
  // FIX-003 (G-02): the record must belong to the caller's org.
  assertRecordInCallerOrg(ctx, membership.organizationId, 'this membership');
  const enriched = withComputedStatus(membership);

  if (enriched.status !== 'suspended') {
    throw new BusinessLogicError(
      `Cannot unsuspend a membership with status '${enriched.status}'. Only suspended memberships can be unsuspended.`,
      'MEMBERSHIP_NOT_SUSPENDED',
    );
  }

  const updated = await persistWithComputedStatus(db, membershipId, membership, {
    suspendedAt: null,
  });

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', 'Membership suspension lifted');

  return ctx.json(updated, 200);
}
