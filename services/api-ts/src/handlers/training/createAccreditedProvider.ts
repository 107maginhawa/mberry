import type { Context } from 'hono';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

export async function createAccreditedProvider(ctx: Context): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.req.param('organizationId')!;
  ctx.set('organizationId', orgId);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const db = ctx.get('database');
  const logger = ctx.get('logger');
  const body = await ctx.req.json();
  const repo = new AccreditedProviderRepository(db, logger);

  const provider = await repo.createOne({
    organizationId: orgId,
    name: body.name,
    accreditationNumber: body.accreditationNumber,
    status: body.status ?? 'active',
    expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
  });

  return ctx.json({ data: provider }, 201);
}
