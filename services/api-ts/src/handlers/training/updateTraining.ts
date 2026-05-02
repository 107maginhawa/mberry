import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import type { Session } from '@/types/auth';

export async function updateTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Training not found');

  const updated = await repo.update(id, {
    ...body,
    startAt: body.startAt ? new Date(body.startAt) : undefined,
    endAt: body.endAt ? new Date(body.endAt) : undefined,
    creditValue: body.creditValue !== undefined ? String(body.creditValue) : undefined,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
