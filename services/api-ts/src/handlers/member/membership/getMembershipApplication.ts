import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '@/core/errors';
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

  // FIX-004 (G-03): object-level authorization. The route grants `user:owner`
  // but the middleware delegates the ownership decision to this handler, which
  // previously checked only that a session existed — exposing every applicant's
  // PII to any logged-in user (IDOR). An application is readable by its owner
  // (the applicant) OR by a caller scoped to the application's org
  // (officer/admin via org context).
  const user = ctx.get('user');
  const orgId = ctx.get('organizationId') as string | undefined;
  const isOwner = !!user && application.personId === user.id;
  const isSameOrg = !!orgId && application.organizationId === orgId;
  if (!isOwner && !isSameOrg) {
    throw new ForbiddenError('Access denied to this application');
  }

  return ctx.json(application, 200);
}
