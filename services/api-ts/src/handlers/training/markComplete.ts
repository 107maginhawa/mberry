import type { Context } from 'hono';
import { NotFoundError, ConflictError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { CreditEntryRepository } from '../association:member/repos/credits.repo';
import { getCycleForDate } from '../association:member/utils/credit-cycle';

export async function markComplete(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const trainingId = ctx.req.param('id');
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const training = await repo.getByOrg(trainingId, orgId);
  if (!training) throw new NotFoundError('Training not found');

  // [BR-20] Block completion for cancelled activities
  if (training.status === 'cancelled') {
    throw new ConflictError('Cannot mark complete: training activity is cancelled');
  }

  // [BR-20] Block completion before activity end date has passed
  if (training.endDate && new Date(training.endDate) > new Date()) {
    throw new ConflictError('Cannot mark complete: training activity has not ended yet');
  }

  // Check enrollment before marking complete
  const enrollmentCount = await repo.getEnrollmentCount(trainingId);
  if (enrollmentCount === 0) throw new ConflictError('No active enrollment found');

  // Update enrollment status to completed
  const enrollments = await repo.listEnrollments(trainingId);
  const personEnrollment = enrollments.find((e) => e.personId === body.personId);
  if (!personEnrollment) throw new NotFoundError('Enrollment not found');
  if (personEnrollment.completedAt) throw new ConflictError('Already marked as completed');

  const updated = await repo.updateEnrollmentStatus(personEnrollment.id, 'completed');

  // [BR-13] Auto-create credit entry for credit-bearing trainings
  if (training.creditAmount && training.creditAmount > 0) {
    try {
      const creditRepo = new CreditEntryRepository(db);
      const activityDate = training.endDate ?? new Date();
      const cycle = getCycleForDate(activityDate, activityDate, 2);

      await creditRepo.createOne({
        personId: body.personId,
        organizationId: training.organizationId,
        type: 'auto',
        trainingId: training.id,
        activityName: training.title,
        provider: training.organizationId,
        activityDate,
        creditAmount: training.creditAmount,
        cycleStart: cycle.cycleStart,
        cycleEnd: cycle.cycleEnd,
      });
    } catch {
      // Credit creation failure should not block marking complete
    }
  }

  return ctx.json({ data: updated }, 201);
}
