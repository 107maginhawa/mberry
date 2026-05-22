import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { DeleteMembershipTierParams } from '@/generated/openapi/validators';
import { MembershipTierRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

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

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'membership-tier',
    resourceId: tierId,
    description: 'Membership tier deleted',
  });

  return ctx.body(null, 204);
}
