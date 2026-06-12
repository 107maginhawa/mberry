import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { ReinstateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { membershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { withComputedStatus, persistWithComputedStatus } from './utils/membership-status-middleware';
import { assertRecordInCallerOrg } from './utils/assert-record-org';
import { computeNewExpiry } from './utils/expiry-extension';

/**
 * FIX-008 / decision #1: reinstate is LAPSED-ONLY.
 *  - REMOVED / RESIGNED / DECEASED / EXPELLED are terminal + irreversible —
 *    re-entry goes through re-application (approve flow), never reinstate.
 *  - SUSPENDED is restored via the dedicated `unsuspendMembership` op.
 *  - LAPSED is the only reinstatable status; reinstating it restores active
 *    standing by extending the dues expiry back into the future.
 */
const REINSTATABLE_STATUSES = ['lapsed'];

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
  // FIX-003 (G-02): the record must belong to the caller's org.
  assertRecordInCallerOrg(ctx, membership.organizationId, 'this membership');
  const enriched = withComputedStatus(membership);

  if (!REINSTATABLE_STATUSES.includes(enriched.status)) {
    throw new BusinessLogicError(
      `Cannot reinstate a membership with status '${enriched.status}'. Only lapsed memberships can be reinstated — suspended members use unsuspend, and removed/resigned/deceased/expelled are terminal.`,
      'MEMBERSHIP_NOT_REINSTATABLE',
    );
  }

  // Restore active standing by extending the dues expiry. computeNewExpiry
  // (BR-07) resets from today when the prior expiry is more than one billing
  // cycle in the past — which a lapsed membership always is — so the result is
  // in the future and the recomputed status becomes 'active'.
  const newExpiry = computeNewExpiry({
    currentExpiry: membership.duesExpiryDate ? new Date(membership.duesExpiryDate) : null,
    billingCycle: 'annual',
  });

  const updated = await persistWithComputedStatus(db, membershipId, membership, {
    duesExpiryDate: newExpiry.toISOString().split('T')[0],
  });

  // FIX-006 / G-08: record the officer-initiated transition for the audit trail.
  if (membership.personId) {
    await db.insert(membershipStatusHistory).values({
      organizationId: membership.organizationId,
      membershipId,
      personId: membership.personId,
      fromStatus: enriched.status,
      toStatus: updated.status,
      reason: 'reinstated',
      changedBy: session.user.id,
      changedAt: new Date(),
    });
  }

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', 'Membership reinstated');

  return ctx.json(updated, 200);
}
