import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { RefundEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRegistrationRepository } from './repos/events.repo';

/**
 * refundEventRegistration
 *
 * Path: POST /association/events/registrations/{registrationId}/refund
 * OperationId: refundEventRegistration
 */
export async function refundEventRegistration(
  ctx: ValidatedContext<never, never, RefundEventRegistrationParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRegistrationRepository(db, logger);

  const existing = await repo.findOneById(params.registrationId);
  if (!existing) throw new NotFoundError('Event registration not found');

  if (existing.status === 'refunded') {
    throw new BusinessLogicError('Registration is already refunded', 'ALREADY_REFUNDED');
  }

  const refunded = await repo.updateOneById(params.registrationId, {
    status: 'refunded',
    refundedAt: new Date(),
  } as Record<string, unknown>);

  ctx.set('auditResourceId', refunded.id);
  ctx.set('auditDescription', 'Event registration refunded');

  return ctx.json(refunded, 200);
}
