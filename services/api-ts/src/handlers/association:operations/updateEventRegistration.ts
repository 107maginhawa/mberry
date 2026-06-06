import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateEventRegistrationBody, UpdateEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRegistrationRepository } from './repos/events.repo';

/**
 * updateEventRegistration
 *
 * Path: PATCH /association/events/registrations/{registrationId}
 * OperationId: updateEventRegistration
 */
export async function updateEventRegistration(
  ctx: ValidatedContext<UpdateEventRegistrationBody, never, UpdateEventRegistrationParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRegistrationRepository(db, logger);

  const existing = await repo.findOneById(params.registrationId);
  if (!existing) throw new NotFoundError('Event registration not found');

  const updated = await repo.updateOneById(params.registrationId, body as Record<string, unknown>);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Event registration updated');

  return ctx.json(updated, 200);
}
