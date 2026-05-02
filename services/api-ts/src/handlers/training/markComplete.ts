import type { Context } from 'hono';
import { NotFoundError, ConflictError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';

export async function markComplete(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const trainingId = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const training = await repo.get(trainingId);
  if (!training) throw new NotFoundError('Training not found');

  const alreadyCompleted = await repo.isCompleted(trainingId, body.personId);
  if (alreadyCompleted) throw new ConflictError('Already marked as completed');

  // Lock credit value after first completion
  if (!training.creditValueLocked) {
    await repo.update(trainingId, { creditValueLocked: true });
  }

  const attendance = await repo.markComplete({
    trainingId,
    personId: body.personId,
    method: body.method ?? 'manual',
    creditsAwarded: training.creditValue,
    createdBy: body.personId,
    updatedBy: body.personId,
  });

  return ctx.json({ data: attendance }, 201);
}
