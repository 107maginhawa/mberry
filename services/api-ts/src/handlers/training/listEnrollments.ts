import type { Context } from 'hono';
import { NotFoundError, ForbiddenError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import type { Session } from '@/types/auth';

export async function listEnrollments(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const trainingId = ctx.req.param('id')!;
  const orgId = ctx.req.param('organizationId')!;

  // [P0-AUTH] Officer role check — only officers can view enrollment lists
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to view enrollments');
  }

  const repo = new TrainingRepository(db);

  const training = await repo.getByOrg(trainingId, orgId);
  if (!training) throw new NotFoundError('Training not found');

  const enrollments = await repo.listEnrollments(trainingId);
  const stats = await repo.getAttendanceStats(trainingId);

  return ctx.json({ data: enrollments, stats }, 200);
}
