import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, BusinessLogicError, ConflictError } from '@/core/errors';
import type { ApproveMembershipApplicationParams } from '@/generated/openapi/validators';
import { MembershipApplicationRepository, MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import type { Membership, MembershipApplication, NewMembership } from '@/handlers/association:member/repos/membership.schema';
import { membershipStatusHistory } from '@/handlers/association:member/repos/status-history.schema';
import { withComputedStatus } from './utils/membership-status-middleware';
import { assertRecordInCallerOrg } from './utils/assert-record-org';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

// FIX-010 / decision #5: statuses from which a person may RE-APPLY by reusing
// the existing (organizationId, personId) row. Terminal states + lapsed/expired
// qualify; an in-standing membership (active/grace/pending/suspended) does not.
const REUSABLE_STATUSES = ['removed', 'resigned', 'deceased', 'expelled', 'expired', 'lapsed'];

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
  // FIX-003 (G-02): the application must belong to the caller's org.
  assertRecordInCallerOrg(ctx, application.organizationId, 'this application');

  const approvableStatuses = ['submitted', 'underReview'];
  if (!approvableStatuses.includes(application.status)) {
    throw new BusinessLogicError(
      `Cannot approve an application with status '${application.status}'. Must be submitted or underReview.`,
      'APPLICATION_NOT_APPROVABLE',
    );
  }

  const now = new Date();

  // FIX-005 / G-07: the id of the membership created (or reused) below, so the
  // main approval funnel can emit membership.created once the tx commits.
  let membershipId: string | undefined;

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

    // duesExpiryDate is null until payment settles (BR-01)
    const today = now.toISOString().split('T')[0];

    // FIX-010 / decision #5: a person may already have a membership row for this
    // org (re-application after a terminal/lapsed state). The (organizationId,
    // personId) unique index means a fresh INSERT would 500, so REUSE the row:
    // flip it back through a clean pendingPayment + record a status-history row.
    const existing = await txMembershipRepo.findByPersonAndOrg(
      application.personId,
      application.organizationId,
    );

    if (existing) {
      const enriched = withComputedStatus(existing);
      if (!REUSABLE_STATUSES.includes(enriched.status)) {
        throw new ConflictError(
          'An active membership already exists for this person in this organization',
        );
      }

      await txMembershipRepo.updateOneById(existing.id, {
        tierId: application.tierId,
        status: 'pendingPayment',
        duesExpiryDate: null,
        startDate: today as string,
        joinedAt: now,
        suspendedAt: null,
        removedAt: null,
        resignedAt: null,
        removalReason: null,
        dateOfDeath: null,
      } as Partial<Membership>);

      await tx.insert(membershipStatusHistory).values({
        organizationId: existing.organizationId,
        membershipId: existing.id,
        personId: existing.personId,
        fromStatus: enriched.status,
        toStatus: 'pendingPayment',
        reason: 're-application approved',
        changedBy: session.user.id,
        changedAt: now,
      });

      membershipId = existing.id;
    } else {
      const created = await txMembershipRepo.createOne({
        organizationId: application.organizationId,
        personId: application.personId,
        tierId: application.tierId,
        startDate: today as string,
        duesExpiryDate: null,
        status: 'pendingPayment',
        joinedAt: now,
      } as NewMembership);

      membershipId = created.id;
    }

    return updated;
  });

  ctx.set('auditResourceId', applicationId);
  ctx.set('auditDescription', 'Membership application approved');

  // FIX-005 / G-07: emit membership.created on the main approval funnel so the
  // existing welcome consumer (domain-event-consumers.ts) fires — previously
  // only the invite funnel (claimInvite) emitted it. Fire-and-forget.
  if (membershipId) {
    domainEvents.emit('membership.created', {
      membershipId,
      personId: application.personId,
      organizationId: application.organizationId,
      source: 'application',
    }).catch(() => {});
  }

  return ctx.json(updatedApplication, 200);
}
