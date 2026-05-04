import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';

export async function cancelTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const orgId = ctx.req.param('orgId');
  const repo = new TrainingRepository(db);

  const existing = await repo.getByOrg(id, orgId);
  if (!existing) throw new NotFoundError('Training not found');

  const updated = await repo.update(id, { status: 'cancelled' });
  return ctx.json({ data: updated }, 200);
}
