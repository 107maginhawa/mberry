import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CancelEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRegistrationRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';

/**
 * cancelEventRegistration
 *
 * Path: POST /association/events/registrations/{registrationId}/cancel
 * OperationId: cancelEventRegistration
 */
export async function cancelEventRegistration(
  ctx: ValidatedContext<never, never, CancelEventRegistrationParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRegistrationRepository(db, logger);

  const existing = await repo.findOneById((params as any).registrationId);
  if (!existing) throw new NotFoundError('Event registration not found');

  if (existing.status === 'cancelled') {
    throw new BusinessLogicError('Registration is already cancelled', 'ALREADY_CANCELLED');
  }

  const cancelled = await repo.updateOneById((params as any).registrationId, {
    status: 'cancelled',
    cancelledAt: new Date(),
  } as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'event-registration',
    resourceId: cancelled.id,
    description: 'Event registration cancelled',
  });

  return ctx.json(cancelled, 200);
}
