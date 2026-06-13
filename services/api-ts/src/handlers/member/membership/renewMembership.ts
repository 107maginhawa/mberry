import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { RenewMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { membershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { withComputedStatus, persistWithComputedStatus } from './utils/membership-status-middleware';
import { assertRecordInCallerOrg } from './utils/assert-record-org';
import { computeNewExpiry } from './utils/expiry-extension';
import { toBillingCycle } from './utils/membership-lifecycle';

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
  // FIX-003 (G-02): the record must belong to the caller's org.
  assertRecordInCallerOrg(ctx, membership.organizationId, 'this membership');
  const enriched = withComputedStatus(membership);

  const renewableStatuses = ['active', 'gracePeriod', 'lapsed'];
  if (!renewableStatuses.includes(enriched.status)) {
    throw new BusinessLogicError(
      `Cannot renew a membership with status '${enriched.status}'. Must be active, gracePeriod, or lapsed.`,
      'MEMBERSHIP_NOT_RENEWABLE',
    );
  }

  // FIX-014 / G-16: extend by the org's billing frequency (quarterly /
  // semi-annual / annual / custom), not a hardcoded +1 year. Reuses the same
  // BR-07 extension math (computeNewExpiry) the payment-settlement path uses so
  // renewal and payment agree. Lazy import of DuesRepository avoids a circular
  // dep (mirrors membershipLifecycle.settlePayment).
  const { DuesRepository } = await import('@/handlers/dues/repos/dues-payments.repo');
  const duesConfig = await new DuesRepository(db).getConfig(membership.organizationId);
  const billingCycle = toBillingCycle(duesConfig?.billingFrequency);
  const newExpiry = computeNewExpiry({
    currentExpiry: membership.duesExpiryDate ? new Date(membership.duesExpiryDate) : null,
    billingCycle,
  });
  const newExpiryDate = newExpiry.toISOString().split('T')[0];

  const updated = await persistWithComputedStatus(db, membershipId, membership, {
    duesExpiryDate: newExpiryDate,
  });

  // FIX-006 / G-08: record the officer-initiated transition for the audit trail.
  if (membership.personId) {
    await db.insert(membershipStatusHistory).values({
      organizationId: membership.organizationId,
      membershipId,
      personId: membership.personId,
      fromStatus: enriched.status,
      toStatus: updated.status,
      reason: 'renewed',
      changedBy: session.user.id,
      changedAt: new Date(),
    });
  }

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', 'Membership renewed');

  return ctx.json(updated, 200);
}
