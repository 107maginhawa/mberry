import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { GetNationalChapterDetailQuery, GetNationalChapterDetailParams } from '@/generated/openapi/validators';
import { DashboardRepository } from './repos/dashboard.repo';
import { auditAction } from '@/utils/audit';
import {
  resolveAssociationAccess,
  isSuppressed,
  pct,
  toCents,
  type SessionUser,
} from './utils/national-access';

/**
 * getNationalChapterDetail
 *
 * Path: GET /admin/national/chapters/{organizationId}
 * OperationId: getNationalChapterDetail
 *
 * S10 row 3 / WF-085 drill-down. Detailed single-chapter metrics with member
 * status and credit compliance breakdowns. BR-36 access; M14-R2 suppression.
 */
export async function getNationalChapterDetail(
  ctx: ValidatedContext<never, GetNationalChapterDetailQuery, GetNationalChapterDetailParams>,
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const snapshotMonth = query.snapshotMonth ?? new Date().toISOString().slice(0, 7);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new DashboardRepository(db, logger);

  const user = session.user as SessionUser | undefined;
  const associationId = await resolveAssociationAccess(repo, user, query.associationId);

  const snapshot = await repo.getChapterSnapshot(organizationId, snapshotMonth, associationId);
  if (!snapshot) throw new NotFoundError('Chapter');

  const names = await repo.getOrgNames([organizationId]);
  const suppressed = isSuppressed(snapshot.totalMembers);

  const active = snapshot.activeMembers ?? 0;
  const grace = snapshot.graceMembers ?? 0;
  const lapsed = snapshot.lapsedMembers ?? 0;
  const suspended = snapshot.suspendedMembers ?? 0;
  const cpdRate = Number(snapshot.cpdComplianceRate ?? 0);
  const compliant = Math.round(cpdRate * snapshot.totalMembers);
  const totalCollected = Number(snapshot.totalCollected ?? 0);

  await auditAction(ctx, {
    action: 'read',
    resourceType: 'national_chapter_detail',
    resourceId: organizationId,
    description: `Chapter drill-down viewed for ${organizationId} (${snapshotMonth})`,
    details: { associationId, snapshotMonth },
  });

  return ctx.json(
    {
      data: {
        organizationId,
        organizationName: names.get(organizationId),
        totalMembers: snapshot.totalMembers,
        activeMembers: suppressed ? 0 : active,
        activePercentage: suppressed ? 0 : pct(active, snapshot.totalMembers),
        memberStatusBreakdown: suppressed
          ? { active: 0, grace: 0, lapsed: 0, suspended: 0 }
          : { active, grace, lapsed, suspended },
        collectionRate: suppressed ? 0 : Number(snapshot.collectionRate ?? 0) * 100,
        totalRevenueCents: suppressed ? 0 : toCents(totalCollected),
        creditCompliance: suppressed ? 0 : cpdRate * 100,
        creditComplianceBreakdown: suppressed
          ? { compliant: 0, nonCompliant: 0, exempt: 0 }
          : { compliant, nonCompliant: snapshot.totalMembers - compliant, exempt: 0 },
        eventCount: suppressed ? 0 : (snapshot.activityCount90d ?? 0),
        trainingCount: 0,
        snapshotMonth,
        isSuppressed: suppressed,
      },
    },
    200,
  );
}
