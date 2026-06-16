import type { Context } from 'hono';
import { clampPageSize } from '@/core/pagination';
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

  const rawLimit = ctx.req.query('limit');
  const limit = clampPageSize(rawLimit == null ? undefined : Number(rawLimit));
  const offset = Math.max(0, Number(ctx.req.query('offset')) || 0);

  const { data, total } = await repo.listWithExpiry(orgId, statusFilter, { limit, offset });

  return ctx.json({ data, total }, 200);
}
