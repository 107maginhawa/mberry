import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';

export async function listMembers(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const status = ctx.req.query('status');
  const categoryId = ctx.req.query('categoryId');
  const search = ctx.req.query('search');
  const limit = parseInt(ctx.req.query('limit') ?? '50', 10);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);

  const repo = new MembershipRepository(db);
  const result = await repo.listMembers({ organizationId: orgId, status, categoryId, search, limit, offset });

  return ctx.json({ data: result.data, meta: { total: result.total, limit, offset } }, 200);
}
