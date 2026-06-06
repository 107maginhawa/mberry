import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { DeleteMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository } from './repos/membership.repo';

/**
 * deleteMembershipApplication
 *
 * Path: DELETE /association/member/applications/{applicationId}
 * OperationId: deleteMembershipApplication
 */
export async function deleteMembershipApplication(
  ctx: ValidatedContext<never, never, DeleteMembershipApplicationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { applicationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipApplicationRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(applicationId);
  if (!existing) throw new NotFoundError('Membership application');

  await repo.deleteOneById(applicationId, session.user.id);

  ctx.set('auditResourceId', applicationId);
  ctx.set('auditDescription', 'Membership application deleted');

  return ctx.body(null, 204);
}
