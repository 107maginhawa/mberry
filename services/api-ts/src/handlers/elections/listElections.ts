import type { Context } from 'hono';
import { ElectionsRepository } from './repos/elections.repo';

export async function listElections(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const repo = new ElectionsRepository(db);
  const data = await repo.list(orgId);
  return ctx.json({ data }, 200);
}
