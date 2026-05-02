import type { Context } from 'hono';
import { CommunicationsRepository } from './repos/communications.repo';

export async function listAnnouncements(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const status = ctx.req.query('status');
  const search = ctx.req.query('search');
  const limit = parseInt(ctx.req.query('limit') ?? '20', 10);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);

  const repo = new CommunicationsRepository(db);
  const result = await repo.list(orgId, { status, search, limit, offset });
  return ctx.json({ data: result.data, meta: { total: result.total, limit, offset } }, 200);
}
