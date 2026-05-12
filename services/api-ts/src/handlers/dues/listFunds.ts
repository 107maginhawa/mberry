import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';

export async function listFunds(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.query('organizationId');
  if (!orgId) {
    return ctx.json({ error: 'organizationId is required' }, 400);
  }
  const repo = new DuesRepository(db);

  const funds = await repo.listFunds(orgId);
  return ctx.json({ data: funds }, 200);
}
