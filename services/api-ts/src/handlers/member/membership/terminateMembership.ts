import type { ValidatedContext } from '@/types/app';
import type { BetterAuthInternalApi } from '@/types/auth';
import type { Membership } from '@/handlers/association:member/repos/membership.schema';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { TerminateMembershipBody, TerminateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { membershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { withComputedStatus } from './utils/membership-status-middleware';
import { assertRecordInCallerOrg } from './utils/assert-record-org';
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
  // FIX-003 (G-02): the record must belong to the caller's org.
  assertRecordInCallerOrg(ctx, membership.organizationId, 'this membership');
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

  // FIX-006 / G-08: record the officer-initiated transition for the audit trail.
  if (membership.personId) {
    await db.insert(membershipStatusHistory).values({
      organizationId: membership.organizationId,
      membershipId,
      personId: membership.personId,
      fromStatus: enriched.status,
      toStatus: 'removed',
      reason: body.terminationReason ?? 'terminated',
      changedBy: session.user.id,
      changedAt: new Date(),
    });
  }

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
    const baseLogger = ctx.get('logger');
    const traceId = ctx.get('requestId');
    const logger = baseLogger?.child?.({ traceId, module: 'association:member' }) ?? baseLogger;
    logger?.warn({ action: 'terminateMembership.1', error: err, personId: membership.personId }, 'Failed to revoke sessions after membership removal');
  }

  return ctx.json(updated, 200);
}
