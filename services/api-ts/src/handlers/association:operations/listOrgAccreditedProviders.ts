import type { Context } from 'hono';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';

export async function listOrgAccreditedProviders(ctx: Context): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.req.param('organizationId')!;
  ctx.set('organizationId', orgId);

  const db = ctx.get('database');
  const logger = ctx.get('logger');
  const statusFilter = ctx.req.query('status');
  const repo = new AccreditedProviderRepository(db, logger);

  const { data, total } = await repo.listWithExpiry(orgId, statusFilter);

  return ctx.json({ data, total }, 200);
}
