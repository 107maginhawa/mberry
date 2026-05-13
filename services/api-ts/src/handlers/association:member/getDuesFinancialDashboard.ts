import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';
import type { GetDuesFinancialDashboardParams } from '@/generated/openapi/validators';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';

/**
 * getDuesFinancialDashboard
 *
 * Path: GET /association/member/dues-reporting/{organizationId}/dashboard
 * OperationId: getDuesFinancialDashboard
 */
export async function getDuesFinancialDashboard(
  ctx: ValidatedContext<never, never, GetDuesFinancialDashboardParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { organizationId } = ctx.req.valid('param');
  const ctxOrgId = ctx.get('organizationId');
  if (ctxOrgId && organizationId !== ctxOrgId) throw new ForbiddenError();

  ctx.set('organizationId', organizationId);
  const denied = await requirePosition(ctx, [POSITION_TITLES.TREASURER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const stats = await repo.getDashboardStats(organizationId);

  // Check gateway configuration
  const gatewayConfig = await repo.getGatewayConfig(organizationId);

  // Ensure all numeric fields are plain numbers (not BigInt) for JSON serialization
  return ctx.json({
    totalCollected: Number(stats.totalCollected),
    totalOutstanding: Number(stats.totalOutstanding),
    pendingCount: Number(stats.pendingCount),
    completedCount: Number(stats.completedCount),
    totalCount: Number(stats.totalCount),
    collectionRate: Number(stats.collectionRate),
    gatewayConfigured: !!gatewayConfig?.connected,
    expiringThisMonth: 0, // TODO: implement with membership expiry query in Slice 3
  }, 200);
}
