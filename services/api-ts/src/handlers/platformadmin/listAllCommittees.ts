import type { Context } from 'hono';
import { CommitteeRepository } from '@/handlers/association:operations/repos/committee.repo';

/**
 * listAllCommittees — Platform admin cross-org committee list.
 * Path: GET /admin/committees
 */
export async function listAllCommittees(ctx: Context): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const limit = Math.min(Number(ctx.req.query('limit') ?? 100), 500);
  const offset = Number(ctx.req.query('offset') ?? 0);

  const db = ctx.get('database');
  const repo = new CommitteeRepository(db);

  const committees = await repo.listAll(limit, offset);

  return ctx.json({ data: committees }, 200);
}
