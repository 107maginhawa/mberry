import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import { withComputedStatus } from '../association:member/utils/membership-status-middleware';
import type { Session } from '@/types/auth';

export async function enroll(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;
  const trainingId = ctx.req.param('id')!;
  const repo = new TrainingRepository(db);

  const training = await repo.getByOrg(trainingId, orgId);
  if (!training) throw new NotFoundError('Training not found');

  // [M9-R3] Block enrollment for completed trainings
  if (training.status === 'completed') {
    throw new BusinessLogicError('Cannot enroll: training is completed', 'TRAINING_COMPLETED');
  }

  // Block enrollment for cancelled trainings
  if (training.status === 'cancelled') {
    throw new BusinessLogicError('Cannot enroll: training is cancelled', 'TRAINING_CANCELLED');
  }

  // [M9-R2] Block enrollment in paid trainings without payment
  if (training.registrationFee && training.registrationFee > 0) {
    throw new BusinessLogicError(
      'Paid training requires payment before enrollment. Use the payment gateway.',
      'PAYMENT_REQUIRED'
    );
  }

  // [BR-02] Only active members can enroll in training
  const membershipRepo = new MembershipRepository(db, ctx.get('logger'));
  const membership = await membershipRepo.findByPersonAndOrg(session.user.id, training.organizationId);
  const enrichedMembership = membership ? withComputedStatus(membership) : null;
  if (!enrichedMembership || enrichedMembership.status !== 'active') {
    throw new BusinessLogicError('Active membership required to enroll in training');
  }

  const count = await repo.getEnrollmentCount(trainingId);
  const isWaitlisted = training.capacity ? count >= training.capacity : false;

  const enrollment = await repo.enroll({
    trainingId,
    personId: session.user.id,
    status: isWaitlisted ? 'cancelled' : 'enrolled',
    organizationId: training.organizationId,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: enrollment }, 201);
}
