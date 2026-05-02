import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';

export async function updateElectionStatus(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new ElectionsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Election not found');

  const extra: any = {};
  if (body.status === 'published') extra.publishedAt = new Date();

  const updated = await repo.update(id, { status: body.status, ...extra });
  return ctx.json({ data: updated }, 200);
}
