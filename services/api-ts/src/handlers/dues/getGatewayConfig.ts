import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';

export async function getGatewayConfig(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId');
  const repo = new DuesRepository(db);

  const config = await repo.getGatewayConfig(orgId);
  if (!config) {
    return ctx.json({ data: { connected: false } }, 200);
  }

  return ctx.json({
    data: {
      connected: config.connected,
      provider: config.provider,
      publicKeyLast4: config.publicKey.slice(-4),
      lastTestAt: config.lastTestAt,
    },
  }, 200);
}
