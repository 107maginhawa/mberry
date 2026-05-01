import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { UpdateMembershipApplicationBody, UpdateMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateMembershipApplication
 *
 * Path: PATCH /association/member/applications/{applicationId}
 * OperationId: updateMembershipApplication
 */
export async function updateMembershipApplication(
  ctx: ValidatedContext<UpdateMembershipApplicationBody, never, UpdateMembershipApplicationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { applicationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipApplicationRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(applicationId);
  if (!existing) throw new NotFoundError('Membership application');

  const updated = await repo.updateOneById(applicationId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'membership-application',
    resourceId: applicationId,
    description: 'Membership application updated',
  });

  return ctx.json(updated, 200);
}
