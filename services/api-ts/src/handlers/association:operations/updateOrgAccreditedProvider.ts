import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { AccreditedProviderRepository } from './repos/accredited-provider.repo';

export async function updateOrgAccreditedProvider(ctx: Context): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.req.param('organizationId')!;
  ctx.set('organizationId', orgId);

  const providerId = ctx.req.param('providerId')!;
  const db = ctx.get('database');
  const logger = ctx.get('logger');
  const body = await ctx.req.json();
  const repo = new AccreditedProviderRepository(db, logger);

  const existing = await repo.getByOrg(providerId, orgId);
  if (!existing) throw new NotFoundError('Accredited provider not found');

  const updated = await repo.update(providerId, {
    name: body.name,
    accreditationNumber: body.accreditationNumber,
    status: body.status,
    expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
  });

  return ctx.json({ data: updated }, 200);
}
