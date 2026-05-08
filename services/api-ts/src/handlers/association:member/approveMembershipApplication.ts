import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { ApproveMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository, MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * approveMembershipApplication
 *
 * Path: POST /association/member/applications/{applicationId}/approve
 * OperationId: approveMembershipApplication
 */
export async function approveMembershipApplication(
  ctx: ValidatedContext<never, never, ApproveMembershipApplicationParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { applicationId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const appRepo = new MembershipApplicationRepository(db, logger);
  const membershipRepo = new MembershipRepository(db, logger);

  const application = await appRepo.findOneById(applicationId);
  if (!application) throw new NotFoundError('Membership application');

  const approvableStatuses = ['submitted', 'underReview'];
  if (!approvableStatuses.includes(application.status)) {
    throw new BusinessLogicError(
      `Cannot approve an application with status '${application.status}'. Must be submitted or underReview.`,
      'APPLICATION_NOT_APPROVABLE',
    );
  }

  const now = new Date();

  // Update the application status
  const updatedApplication = await appRepo.updateOneById(applicationId, {
    status: 'approved',
    reviewedBy: session.user.id,
    reviewedAt: now,
  } as any);

  // Create a membership record from the application
  const today = now.toISOString().split('T')[0];
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const expiryDate = oneYearLater.toISOString().split('T')[0];

  await membershipRepo.createOne({
    organizationId: application.organizationId,
    personId: application.personId,
    tierId: application.tierId,
    startDate: today as string,
    duesExpiryDate: expiryDate as string,
    status: 'pendingPayment' as any,
    joinedAt: now,
  } as any);

  await auditAction(ctx, {
    action: 'approve',
    resourceType: 'membership-application',
    resourceId: applicationId,
    description: 'Membership application approved',
  });

  return ctx.json(updatedApplication, 200);
}
