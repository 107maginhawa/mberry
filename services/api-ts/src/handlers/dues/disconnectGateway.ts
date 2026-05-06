import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { duesGatewayConfigs } from './repos/dues.schema';
import { NotFoundError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';

export async function disconnectGateway(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');

  const repo = new DuesRepository(db);
  const config = await repo.getGatewayConfig(orgId);
  if (!config) throw new NotFoundError('No gateway configured');

  await db
    .update(duesGatewayConfigs)
    .set({ connected: false, updatedAt: new Date() })
    .where(eq(duesGatewayConfigs.organizationId, orgId));

  return ctx.json({ data: { connected: false } }, 200);
}
