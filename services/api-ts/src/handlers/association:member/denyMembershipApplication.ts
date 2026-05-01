import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { DenyMembershipApplicationBody, DenyMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * denyMembershipApplication
 *
 * Path: POST /association/member/applications/{applicationId}/deny
 * OperationId: denyMembershipApplication
 */
export async function denyMembershipApplication(
  ctx: ValidatedContext<DenyMembershipApplicationBody, never, DenyMembershipApplicationParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { applicationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipApplicationRepository(db, ctx.get('logger'));

  const application = await repo.findOneById(applicationId);
  if (!application) throw new NotFoundError('Membership application');

  const deniableStatuses = ['submitted', 'underReview'];
  if (!deniableStatuses.includes(application.status)) {
    throw new BusinessLogicError(
      `Cannot deny an application with status '${application.status}'. Must be submitted or underReview.`,
      'APPLICATION_NOT_DENIABLE',
    );
  }

  const updated = await repo.updateOneById(applicationId, {
    status: 'denied',
    reviewedBy: session.user.id,
    reviewedAt: new Date(),
    denialReason: body.denialReason ?? null,
  } as any);

  await auditAction(ctx, {
    action: 'deny',
    resourceType: 'membership-application',
    resourceId: applicationId,
    description: 'Membership application denied',
  });

  return ctx.json(updated, 200);
}
