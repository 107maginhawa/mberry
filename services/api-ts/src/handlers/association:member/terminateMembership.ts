import type { ValidatedContext } from '@/types/app';
import type { BetterAuthInternalApi } from '@/types/auth';
import type { Membership } from './repos/membership.schema';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { TerminateMembershipBody, TerminateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { withComputedStatus } from './utils/membership-status-middleware';
import { assertValidTransition } from '@/utils/status-transitions';
import { MEMBERSHIP_VALID_TRANSITIONS } from './utils/status-transitions';

/**
 * terminateMembership
 *
 * Path: POST /association/member/memberships/{membershipId}/terminate
 * OperationId: terminateMembership
 */
export async function terminateMembership(
  ctx: ValidatedContext<TerminateMembershipBody, never, TerminateMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');
  const enriched = withComputedStatus(membership);

  if (enriched.status === 'pendingPayment') {
    throw new BusinessLogicError(
      'Cannot terminate a pending membership. Use deny instead.',
      'CANNOT_TERMINATE_PENDING',
    );
  }
  assertValidTransition(MEMBERSHIP_VALID_TRANSITIONS, enriched.status, 'removed', 'membership');

  const updated = await repo.updateOneById(membershipId, {
    status: 'removed',
    removedAt: new Date(),
    removalReason: body.terminationReason ?? null,
  } as Partial<Membership>);

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', 'Membership removed');

  // P1-4: Invalidate removed member's sessions so they can't access org resources
  try {
    const auth = ctx.get('auth');
    if (auth && membership.personId) {
      await (auth.api as unknown as BetterAuthInternalApi).revokeUserSessions({
        body: { userId: membership.personId },
        headers: ctx.req.raw.headers,
      });
    }
  } catch (err) {
    const logger = ctx.get('logger');
    logger?.warn({ error: err, personId: membership.personId }, 'Failed to revoke sessions after membership removal');
  }

  return ctx.json(updated, 200);
}
