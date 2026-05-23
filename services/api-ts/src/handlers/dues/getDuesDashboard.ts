import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetDuesDashboardParams } from '@/generated/openapi/validators';
import { DuesRepository } from './repos/dues.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * getDuesDashboard
 *
 * Path: GET /dashboard/{orgId}
 * OperationId: getDuesDashboard
 *
 * Aggregated dues dashboard statistics for an organisation.
 * Returns collection totals, payment counts, collection rate, and member count.
 *
 * Position-restricted: TREASURER, PRESIDENT only (D-03).
 * Also enforces org-scoping (officer must belong to target org).
 */
export async function getDuesDashboard(
  ctx: ValidatedContext<never, never, GetDuesDashboardParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const params = ctx.req.valid('param');
  const orgId = params.organizationId;

  // Set orgId for requirePosition (route is not under /association/*, no org-context middleware)
  ctx.set('organizationId', orgId);
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const repo = new DuesRepository(db);
  const [stats, memberCount] = await Promise.all([
    repo.getDashboardStats(orgId),
    repo.getMemberCount(orgId),
  ]);

  return ctx.json({
    data: {
      totalCollected: Number(stats.totalCollected),
      totalOutstanding: Number(stats.totalOutstanding),
      paidCount: stats.paidCount,
      unpaidCount: stats.unpaidCount,
      overdueCount: stats.overdueCount,
      collectionRate: stats.collectionRate,
      memberCount,
    },
  }, 200);
}
