import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, ConflictError } from '@/core/errors';
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

  // FIX-015 / BR-04: cannot delete a tier with members assigned — surface a
  // friendly 409 instead of a raw FK-violation 500. Officers should reassign
  // members or retire the tier first.
  const assignedMembers = await repo.countMembersInTier(tierId);
  if (assignedMembers > 0) {
    throw new ConflictError(
      `Cannot delete a membership tier with ${assignedMembers} member(s) assigned. Reassign or retire the tier instead.`,
    );
  }

  await repo.deleteOneById(tierId, session.user.id);

  ctx.set('auditResourceId', tierId);
  ctx.set('auditDescription', 'Membership tier deleted');

  return ctx.body(null, 204);
}
