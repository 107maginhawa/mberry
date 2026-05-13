import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';

export async function getFinancialDashboard(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId');
  const repo = new DuesRepository(db);

  const stats = await repo.getDashboardStats(orgId);
  const gatewayConfig = await repo.getGatewayConfig(orgId);

  return ctx.json({
    data: {
      ...stats,
      gatewayConnected: gatewayConfig?.connected ?? false,
    },
  }, 200);
}
