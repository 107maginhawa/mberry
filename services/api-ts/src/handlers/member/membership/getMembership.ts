import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { GetMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { withComputedStatus } from './utils/membership-status-middleware';

/**
 * getMembership
 *
 * Path: GET /association/member/memberships/{membershipId}
 * OperationId: getMembership
 */
export async function getMembership(
  ctx: ValidatedContext<never, never, GetMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const orgId = ctx.get('organizationId') as string | undefined;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  // Org-scoping: verify record belongs to caller's org (or caller's own person)
  if (orgId && membership.organizationId && membership.organizationId !== orgId) {
    throw new ForbiddenError('Access denied to this membership');
  }

  // FIX-002 (G-10): status truth is computed on read so this surface agrees
  // with listOrgMembers and never serves a stale stored cache value.
  return ctx.json(withComputedStatus(membership), 200);
}
