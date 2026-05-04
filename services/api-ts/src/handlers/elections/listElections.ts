import type { Context } from 'hono';
import { ElectionsRepository } from './repos/elections.repo';

export async function listElections(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const repo = new ElectionsRepository(db);
  const data = await repo.list(orgId, {
    status: ctx.req.query('status') || undefined,
    type: ctx.req.query('type') || undefined,
  });
  return ctx.json({ data }, 200);
}
