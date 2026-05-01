import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { DeleteMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteMembership
 *
 * Path: DELETE /association/member/memberships/{membershipId}
 * OperationId: deleteMembership
 */
export async function deleteMembership(
  ctx: ValidatedContext<never, never, DeleteMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(membershipId);
  if (!existing) throw new NotFoundError('Membership');

  await repo.deleteOneById(membershipId, session.user.id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'membership',
    resourceId: membershipId,
    description: 'Membership deleted',
  });

  return ctx.body(null, 204);
}
