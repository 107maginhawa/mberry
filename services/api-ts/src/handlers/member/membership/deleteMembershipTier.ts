import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { DeleteMembershipTierParams } from '@/generated/openapi/validators';
import { MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';

/**
 * deleteMembershipTier
 *
 * Path: DELETE /association/member/tiers/{tierId}
 * OperationId: deleteMembershipTier
 */
export async function deleteMembershipTier(
  ctx: ValidatedContext<never, never, DeleteMembershipTierParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { tierId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipTierRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(tierId);
  if (!existing) throw new NotFoundError('Membership tier');

  await repo.deleteOneById(tierId, session.user.id);

  ctx.set('auditResourceId', tierId);
  ctx.set('auditDescription', 'Membership tier deleted');

  return ctx.body(null, 204);
}
