import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { MembershipCategoryRepository } from './repos/membership.repo';

/**
 * getMembershipCategory
 *
 * Path: GET /association/member/membership-categories/:id
 */
export async function getMembershipCategory(
  ctx: ValidatedContext<never, never, { membershipCategoryId: string }>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const id = ctx.req.valid('param').membershipCategoryId;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipCategoryRepository(db, logger);

  const category = await repo.findOneById(id);
  if (!category || category.organizationId !== orgId) {
    throw new NotFoundError('Membership category');
  }

  return ctx.json(category);
}
