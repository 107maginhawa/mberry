import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
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
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DuesRepository(db);

  const stats = await repo.getDashboardStats(organizationId);

  return ctx.json(stats, 200);
}
