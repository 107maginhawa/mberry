import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';

export async function getTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new TrainingRepository(db);
  const training = await repo.get(id);
  if (!training) throw new NotFoundError('Training not found');
  // TODO(org-scoping): routes under /training/:id have no orgId param. Auth middleware
  // restricts access by session, but cross-org data leakage is possible if IDs are
  // guessed. Add orgId to the route and pass it to repo.get() once route is updated.
  const enrollCount = await repo.getEnrollmentCount(id);
  const attStats = await repo.getAttendanceStats(id);
  return ctx.json({ data: { ...training, enrollmentCount: enrollCount, attendance: attStats } }, 200);
}
