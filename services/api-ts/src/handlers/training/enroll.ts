import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import type { Session } from '@/types/auth';

export async function enroll(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const trainingId = ctx.req.param('id');
  const repo = new TrainingRepository(db);

  const training = await repo.getByOrg(trainingId, orgId);
  if (!training) throw new NotFoundError('Training not found');

  // [BR-02] Only active members can enroll in training
  const membershipRepo = new MembershipRepository(db, ctx.get('logger'));
  const membership = await membershipRepo.findByPersonAndOrg(session.user.id, training.organizationId);
  if (!membership || membership.status !== 'active') {
    throw new BusinessLogicError('Active membership required to enroll in training');
  }

  const count = await repo.getEnrollmentCount(trainingId);
  const isWaitlisted = training.capacity ? count >= training.capacity : false;

  const enrollment = await repo.enroll({
    trainingId,
    personId: session.user.id,
    status: isWaitlisted ? 'cancelled' : 'enrolled',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: enrollment }, 201);
}
