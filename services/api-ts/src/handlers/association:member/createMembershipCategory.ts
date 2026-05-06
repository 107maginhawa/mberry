import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { MembershipCategoryRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * createMembershipCategory
 *
 * Path: POST /association/member/membership-categories
 * Officers define categories (Regular, Associate, Student) that drive dues rates.
 */
export async function createMembershipCategory(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipCategoryRepository(db, logger);

  const category = await repo.createOne({
    orgId,
    orgId: body.organizationId || orgId,
    name: body.name,
    description: body.description || null,
    applicableTiers: body.applicableTiers || null,
    createdBy: user.id,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'membership-category',
    resourceId: category.id,
    description: `Membership category "${body.name}" created`,
  });

  return ctx.json(category, 201);
}
