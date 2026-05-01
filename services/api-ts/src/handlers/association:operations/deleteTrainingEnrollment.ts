import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteTrainingEnrollmentParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { TrainingEnrollmentRepository } from './repos/training.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteTrainingEnrollment
 *
 * Path: DELETE /association/training/enrollments/{enrollmentId}
 * OperationId: deleteTrainingEnrollment
 */
export async function deleteTrainingEnrollment(
  ctx: ValidatedContext<never, never, DeleteTrainingEnrollmentParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new TrainingEnrollmentRepository(db, logger);

  const existing = await repo.findOneById((params as any).enrollmentId);
  if (!existing) throw new NotFoundError('Training enrollment not found');

  await repo.deleteOneById((params as any).enrollmentId, user.id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'training-enrollment',
    resourceId: (params as any).enrollmentId,
    description: 'Training enrollment deleted',
  });

  return ctx.json({ success: true }, 200);
}
