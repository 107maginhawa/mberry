import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { UpdateMembershipTierBody, UpdateMembershipTierParams } from '@/generated/openapi/validators';
import { MembershipTierRepository } from '@/handlers/association:member/repos/membership.repo';
import type { MembershipTier } from '@/handlers/association:member/repos/membership.schema';

/**
 * updateMembershipTier
 *
 * Path: PATCH /association/member/tiers/{tierId}
 * OperationId: updateMembershipTier
 */
export async function updateMembershipTier(
  ctx: ValidatedContext<UpdateMembershipTierBody, never, UpdateMembershipTierParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { tierId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipTierRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(tierId);
  if (!existing) throw new NotFoundError('Membership tier');

  const updated = await repo.updateOneById(tierId, body as Partial<MembershipTier>);

  ctx.set('auditResourceId', tierId);
  ctx.set('auditDescription', 'Membership tier updated');

  return ctx.json(updated, 200);
}
