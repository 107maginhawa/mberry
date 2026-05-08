import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { UpdateMembershipBody, UpdateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * updateMembership
 *
 * Path: PATCH /association/member/memberships/{membershipId}
 * OperationId: updateMembership
 */
export async function updateMembership(
  ctx: ValidatedContext<UpdateMembershipBody, never, UpdateMembershipParams>
): Promise<Response> {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(membershipId);
  if (!existing) throw new NotFoundError('Membership');

  const updated = await repo.updateOneById(membershipId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'membership',
    resourceId: membershipId,
    description: 'Membership updated',
  });

  return ctx.json(updated, 200);
}
