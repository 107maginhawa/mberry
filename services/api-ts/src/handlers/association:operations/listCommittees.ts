import type { Context } from 'hono';
import { CommitteeRepository } from './repos/committee.repo';

export async function listCommittees(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId')!;
  const repo = new CommitteeRepository(db);

  const committees = await repo.list(orgId);

  return ctx.json({ data: committees }, 200);
}
