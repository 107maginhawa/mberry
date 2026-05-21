import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { ApproveMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository, MembershipRepository } from './repos/membership.repo';
import type { MembershipApplication, NewMembership } from './repos/membership.schema';
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

  // Wrap approval + membership creation in a transaction so a failed
  // createOne() doesn't leave the application stuck in 'approved' with
  // no membership record.
  const updatedApplication = await db.transaction(async (tx: DatabaseInstance) => {
    const txAppRepo = new MembershipApplicationRepository(tx, logger);
    const txMembershipRepo = new MembershipRepository(tx, logger);

    // Update the application status
    const updated = await txAppRepo.updateOneById(applicationId, {
      status: 'approved',
      reviewedBy: session.user.id,
      reviewedAt: now,
    } as Partial<MembershipApplication>);

    // Create a membership record — duesExpiryDate is null until payment settles (BR-01)
    const today = now.toISOString().split('T')[0];

    await txMembershipRepo.createOne({
      organizationId: application.organizationId,
      personId: application.personId,
      tierId: application.tierId,
      startDate: today as string,
      duesExpiryDate: null,
      status: 'pendingPayment',
      joinedAt: now,
    } as NewMembership);

    return updated;
  });

  await auditAction(ctx, {
    action: 'approve',
    resourceType: 'membership-application',
    resourceId: applicationId,
    description: 'Membership application approved',
    eventSubType: 'membership.member-approved',
  });

  return ctx.json(updatedApplication, 200);
}
