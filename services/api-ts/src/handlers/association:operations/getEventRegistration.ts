import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRegistrationRepository } from './repos/events.repo';

/**
 * getEventRegistration
 *
 * Path: GET /association/events/registrations/{registrationId}
 * OperationId: getEventRegistration
 */
export async function getEventRegistration(
  ctx: ValidatedContext<never, never, GetEventRegistrationParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRegistrationRepository(db, logger);

  const registration = await repo.findOneById(params.registrationId);
  if (!registration) throw new NotFoundError('Event registration not found');

  return ctx.json(registration, 200);
}
