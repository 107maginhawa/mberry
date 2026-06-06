import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { BulkApproveMembershipApplicationsBody } from '@/generated/openapi/validators';
import { MembershipApplicationRepository, MembershipRepository } from './repos/membership.repo';
import type { MembershipApplication, NewMembership } from './repos/membership.schema';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * bulkApproveMembershipApplications
 *
 * Path: POST /association/member/applications/bulk-approve
 * OperationId: bulkApproveMembershipApplications
 *
 * Approves multiple membership applications in a single request.
 * Implements partial-success semantics: each application is processed
 * independently. Per-record org scope validation enforces OPS-03.
 */
export async function bulkApproveMembershipApplications(
  ctx: ValidatedContext<BulkApproveMembershipApplicationsBody, never, never>
): Promise<Response> {
  // Guard: officer-only (Secretary or President)
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // Officer's organization — set by orgContextMiddleware via request headers/JWT
  const officerOrgId = ctx.get('organizationId') as string;

  const body = ctx.req.valid('json');
  const { applicationIds } = body;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const appRepo = new MembershipApplicationRepository(db, logger);

  const succeeded: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  const approvableStatuses = ['submitted', 'underReview'];

  for (const applicationId of applicationIds) {
    // (a) Fetch application
    const application = await appRepo.findOneById(applicationId);
    if (!application) {
      failed.push({ id: applicationId, reason: 'Not found' });
      continue;
    }

    // (b/c) OPS-03: per-record org scope check
    if (application.organizationId !== officerOrgId) {
      failed.push({
        id: applicationId,
        reason: 'Organization scope violation: application belongs to a different chapter',
      });
      continue;
    }

    // (d) Status must be approvable
    if (!approvableStatuses.includes(application.status)) {
      failed.push({
        id: applicationId,
        reason: `Status '${application.status}' is not approvable. Must be submitted or underReview.`,
      });
      continue;
    }

    // (e) Per-record transaction — NOT all-or-nothing across the batch
    try {
      const now = new Date();
      await db.transaction(async (tx: DatabaseInstance) => {
        const txAppRepo = new MembershipApplicationRepository(tx, logger);
        const txMembershipRepo = new MembershipRepository(tx, logger);

        // Update application status to approved
        await txAppRepo.updateOneById(applicationId, {
          status: 'approved',
          reviewedBy: session.user.id,
          reviewedAt: now,
        } as Partial<MembershipApplication>);

        // Create membership record — duesExpiryDate null until payment settles (BR-01)
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
      });

      succeeded.push(applicationId);
    } catch (_err) {
      failed.push({ id: applicationId, reason: 'Internal error during approval' });
    }
  }

  // Audit summary — one entry for the entire bulk operation
  ctx.set('auditResourceId', 'bulk');
  ctx.set('auditDescription', `Bulk approved ${succeeded.length} application(s), ${failed.length} failed`);

  return ctx.json({ succeeded, failed }, 200);
}
