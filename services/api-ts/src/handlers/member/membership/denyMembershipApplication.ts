import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError } from '@/core/errors';
import type { DenyMembershipApplicationBody, DenyMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository } from '@/handlers/association:member/repos/membership.repo';
import type { MembershipApplication } from '@/handlers/association:member/repos/membership.schema';
import { assertRecordInCallerOrg } from './utils/assert-record-org';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * denyMembershipApplication
 *
 * Path: POST /association/member/applications/{applicationId}/deny
 * OperationId: denyMembershipApplication
 */
export async function denyMembershipApplication(
  ctx: ValidatedContext<DenyMembershipApplicationBody, never, DenyMembershipApplicationParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { applicationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipApplicationRepository(db, ctx.get('logger'));

  const application = await repo.findOneById(applicationId);
  if (!application) throw new NotFoundError('Membership application');
  // FIX-003 (G-02): the application must belong to the caller's org.
  assertRecordInCallerOrg(ctx, application.organizationId, 'this application');

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
  } as Partial<MembershipApplication>);

  ctx.set('auditResourceId', applicationId);
  ctx.set('auditDescription', 'Membership application denied');

  return ctx.json(updated, 200);
}
