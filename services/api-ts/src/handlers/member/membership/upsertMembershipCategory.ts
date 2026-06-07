import type { ValidatedContext, AuditEventEntry } from '@/types/app';
import type { MembershipCategory, NewMembershipCategory } from '@/handlers/association:member/repos/membership.schema';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { UpsertMembershipCategoryBody, UpsertMembershipCategoryParams } from '@/generated/openapi/validators';
import { MembershipCategoryRepository } from '@/handlers/association:member/repos/membership.repo';

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

  const bodyRecord = body as Record<string, unknown>;
  const isUpdate = !!bodyRecord['id'];

  const auditEvents: AuditEventEntry[] = [];
  ctx.set('auditEvents', auditEvents);

  let result;
  if (isUpdate) {
    result = await repo.updateOneById(bodyRecord['id'] as string, body as Partial<MembershipCategory>);
  } else {
    result = await repo.createOne({ ...body, organizationId: params.organizationId } as NewMembershipCategory);
  }

  auditEvents.push({
    action: isUpdate ? 'update' : 'create',
    resourceType: 'membership-category',
    resource: (result as Record<string, unknown>)['id'] as string,
    description: `Membership category ${isUpdate ? 'updated' : 'created'}`,
  });

  return ctx.json(result, isUpdate ? 200 : 201);
}