import type { Context } from 'hono';
import { CommitteeRepository } from './repos/committee.repo';
import { NotFoundError } from '@/core/errors';

export async function getCommittee(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new CommitteeRepository(db);

  const committee = await repo.get(id);
  if (!committee) throw new NotFoundError('Committee not found');

  return ctx.json({ data: committee }, 200);
}
