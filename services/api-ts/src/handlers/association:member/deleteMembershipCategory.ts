import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ConflictError } from '@/core/errors';
import { MembershipCategoryRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteMembershipCategory
 *
 * Path: DELETE /association/member/membership-categories/:id
 */
export async function deleteMembershipCategory(
  ctx: ValidatedContext<never, never, { membershipCategoryId: string }>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const id = ctx.req.valid('param').membershipCategoryId;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipCategoryRepository(db, logger);

  const existing = await repo.findOneById(id);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Membership category');
  }

  // BR-04: categories with assigned members cannot be deleted (deactivate only)
  const memberCount = await repo.countMembersInCategory(id);
  if (memberCount > 0) {
    throw new ConflictError(
      `Cannot delete category "${existing.name}": ${memberCount} member(s) still assigned. Reassign members first.`,
    );
  }

  await repo.deleteOneById(id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'membership-category',
    resourceId: id,
    description: `Membership category "${existing.name}" deleted`,
  });

  return ctx.json({ deleted: true }, 200);
}
