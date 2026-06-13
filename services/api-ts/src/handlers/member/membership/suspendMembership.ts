import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { SuspendMembershipBody, SuspendMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { withComputedStatus, persistWithComputedStatus } from './utils/membership-status-middleware';
import { assertRecordInCallerOrg } from './utils/assert-record-org';

/**
 * FIX-009 / decision #1: suspend is a dedicated, reversible officer action
 * (its inverse is `unsuspendMembership`, NOT reinstate). Only memberships in
 * good-or-lapsing standing can be suspended; terminal states stay terminal.
 */
const SUSPENDABLE_STATUSES = ['active', 'gracePeriod', 'lapsed'];

/**
 * suspendMembership
 *
 * Path: POST /association/member/memberships/{membershipId}/suspend
 * OperationId: suspendMembership
 */
export async function suspendMembership(
  ctx: ValidatedContext<SuspendMembershipBody, never, SuspendMembershipParams>
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

  if (!SUSPENDABLE_STATUSES.includes(enriched.status)) {
    throw new BusinessLogicError(
      `Cannot suspend a membership with status '${enriched.status}'. Must be active, gracePeriod, or lapsed.`,
      'MEMBERSHIP_NOT_SUSPENDABLE',
    );
  }

  // suspendedAt outranks the date-derived statuses in computeMembershipStatus,
  // so setting it flips the computed status to 'suspended' regardless of expiry.
  const updated = await persistWithComputedStatus(db, membershipId, membership, {
    suspendedAt: new Date(),
  });

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', `Membership suspended${body.reason ? `: ${body.reason}` : ''}`);

  return ctx.json(updated, 200);
}
