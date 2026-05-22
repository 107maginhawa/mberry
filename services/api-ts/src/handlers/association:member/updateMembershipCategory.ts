import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { MembershipCategoryRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateMembershipCategory
 *
 * Path: PATCH /association/member/membership-categories/:id
 */
export async function updateMembershipCategory(
  ctx: ValidatedContext<any, never, { membershipCategoryId: string }>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const id = ctx.req.valid('param').membershipCategoryId;
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipCategoryRepository(db, logger);

  const existing = await repo.findOneById(id);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Membership category');
  }

  const updated = await repo.updateOneById(id, {
    name: body.name,
    description: body.description,
    applicableTiers: body.applicableTiers,
    updatedBy: user.id,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'membership-category',
    resourceId: id,
    description: `Membership category updated`,
  });

  return ctx.json(updated);
}
