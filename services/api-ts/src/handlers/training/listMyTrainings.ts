import type { Context } from 'hono';
import { TrainingRepository } from './repos/training.repo';
import type { Session } from '@/types/auth';

export async function listMyTrainings(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const repo = new TrainingRepository(db);
  const trainings = await repo.listByPerson(session.user.id);
  return ctx.json({ data: trainings }, 200);
}
