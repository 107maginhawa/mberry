import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { UpsertMembershipCategoryBody, UpsertMembershipCategoryParams } from '@/generated/openapi/validators';
import { MembershipCategoryRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * upsertMembershipCategory
 *
 * Path: PUT /association/member/membership-categories/{organizationId}
 * OperationId: upsertMembershipCategory
 */
export async function upsertMembershipCategory(
  ctx: ValidatedContext<UpsertMembershipCategoryBody, never, UpsertMembershipCategoryParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipCategoryRepository(db, logger);

  const isUpdate = !!(body as any).id;
  let result;

  if (isUpdate) {
    result = await repo.updateOneById((body as any).id, body as any);
  } else {
    result = await repo.createOne({ ...body, organizationId: params.organizationId } as any);
  }

  await auditAction(ctx, {
    action: isUpdate ? 'update' : 'create',
    resourceType: 'membership-category',
    resourceId: (result as any).id,
    description: `Membership category ${isUpdate ? 'updated' : 'created'}`,
  });

  return ctx.json(result, isUpdate ? 200 : 201);
}