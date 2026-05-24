import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';

export async function listCategories(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId')!;

  const repo = new MembershipRepository(db);
  const categories = await repo.listCategories(orgId);

  return ctx.json({ data: categories }, 200);
}
