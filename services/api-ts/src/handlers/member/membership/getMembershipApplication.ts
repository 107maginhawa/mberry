import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { GetMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository } from '@/handlers/association:member/repos/membership.repo';

/**
 * getMembershipApplication
 *
 * Path: GET /association/member/applications/{applicationId}
 * OperationId: getMembershipApplication
 */
export async function getMembershipApplication(
  ctx: ValidatedContext<never, never, GetMembershipApplicationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { applicationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipApplicationRepository(db, ctx.get('logger'));

  const application = await repo.findOneById(applicationId);
  if (!application) throw new NotFoundError('Membership application');

  return ctx.json(application, 200);
}
