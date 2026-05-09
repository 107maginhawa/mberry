import type { Context } from 'hono';
import { ElectionsRepository } from './repos/elections.repo';

export async function listElections(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const repo = new ElectionsRepository(db);

  const limit = Math.min(parseInt(ctx.req.query('limit') ?? '25', 10), 100);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);

  const data = await repo.list(orgId, {
    status: ctx.req.query('status') || undefined,
    type: ctx.req.query('type') || undefined,
    limit,
    offset,
  });
  return ctx.json({ data, meta: { limit, offset } }, 200);
}
