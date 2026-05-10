import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { MembershipCategoryRepository } from './repos/membership.repo';

/**
 * listMembershipCategories
 *
 * Path: GET /association/member/membership-categories
 */
export async function listMembershipCategories(
  ctx: ValidatedContext<never, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipCategoryRepository(db, logger);

  const categories = await repo.findMany({ organizationId: orgId });

  return ctx.json({ data: categories });
}
