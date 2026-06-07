import type { ValidatedContext } from '@/types/app';
import type { Membership } from '@/handlers/association:member/repos/membership.schema';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { UpdateMembershipBody, UpdateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * updateMembership
 *
 * Path: PATCH /association/member/memberships/{membershipId}
 * OperationId: updateMembership
 */
export async function updateMembership(
  ctx: ValidatedContext<UpdateMembershipBody, never, UpdateMembershipParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(membershipId);
  if (!existing) throw new NotFoundError('Membership');

  const updated = await repo.updateOneById(membershipId, body as Partial<Membership>);

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', 'Membership updated');

  return ctx.json(updated, 200);
}
