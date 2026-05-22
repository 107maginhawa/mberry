import type { Context } from 'hono';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function listAccreditedProviders(ctx: Context): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.req.param('organizationId');
  ctx.set('organizationId', orgId);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const db = ctx.get('database');
  const logger = ctx.get('logger');
  const statusFilter = ctx.req.query('status');
  const repo = new AccreditedProviderRepository(db, logger);

  // listWithExpiry computes expiringSoon flag per provider (true if expiryDate <= 30 days away)
  const { data, total } = await repo.listWithExpiry(orgId, statusFilter);

  return ctx.json({ data, total }, 200);
}
