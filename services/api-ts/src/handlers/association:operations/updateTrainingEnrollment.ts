import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateTrainingEnrollmentBody, UpdateTrainingEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { assertValidTransition, TRAINING_ENROLLMENT_VALID_TRANSITIONS } from '@/utils/status-transitions';

/**
 * updateTrainingEnrollment
 *
 * Path: PATCH /association/training/enrollments/{enrollmentId}
 * OperationId: updateTrainingEnrollment
 */
export async function updateTrainingEnrollment(
  ctx: ValidatedContext<UpdateTrainingEnrollmentBody, never, UpdateTrainingEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingEnrollmentRepository(db, logger);

  const existing = await repo.findOneById(params.enrollmentId);
  if (!existing) throw new NotFoundError('Training enrollment not found');

  // BR-43: completed training locks enrollments — no changes post-completion.
  const training = await new TrainingRepository(db, logger).findOneById(existing.trainingId);
  if (training?.status === 'completed') {
    throw new BusinessLogicError(
      'This training is completed. Enrollments are locked and cannot be changed.',
      'TRAINING_COMPLETED',
    );
  }

  // S-G1-04: FSM guard — body.status change must be a valid transition from existing.status.
  // Allows same-status writes (no transition); rejects invalid moves with ConflictError (409).
  const bodyAny = body as Record<string, unknown> | undefined;
  if (bodyAny?.['status'] && bodyAny['status'] !== existing.status) {
    assertValidTransition(
      TRAINING_ENROLLMENT_VALID_TRANSITIONS,
      existing.status,
      String(bodyAny['status']),
      'training enrollment',
    );
  }

  const updated = await repo.updateOneById(params.enrollmentId, body as Record<string, unknown>);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Training enrollment updated');

  return ctx.json(updated, 200);
}
