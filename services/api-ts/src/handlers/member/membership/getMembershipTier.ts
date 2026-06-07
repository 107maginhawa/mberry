import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { GetMembershipTierParams } from '@/generated/openapi/validators';
import { MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';

/**
 * getMembershipTier
 *
 * Path: GET /association/member/tiers/{tierId}
 * OperationId: getMembershipTier
 */
export async function getMembershipTier(
  ctx: ValidatedContext<never, never, GetMembershipTierParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { tierId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipTierRepository(db, ctx.get('logger'));

  const tier = await repo.findOneById(tierId);
  if (!tier) throw new NotFoundError('Membership tier');

  return ctx.json(tier, 200);
}
