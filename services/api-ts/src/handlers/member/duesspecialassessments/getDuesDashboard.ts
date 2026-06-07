import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { GetDuesDashboardParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

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

  const repo = new DuesRepository(db);
  const [stats, memberCount] = await Promise.all([
    repo.getFullDashboardStats(orgId),
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
