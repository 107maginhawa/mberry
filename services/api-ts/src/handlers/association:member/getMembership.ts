import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { GetMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';

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
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  return ctx.json(membership, 200);
}
