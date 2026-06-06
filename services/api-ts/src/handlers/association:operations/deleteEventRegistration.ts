import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRegistrationRepository } from './repos/events.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * deleteEventRegistration
 *
 * Path: DELETE /association/events/registrations/{registrationId}
 * OperationId: deleteEventRegistration
 */
export async function deleteEventRegistration(
  ctx: ValidatedContext<never, never, DeleteEventRegistrationParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRegistrationRepository(db, logger);

  const existing = await repo.findOneById(params.registrationId);
  if (!existing) throw new NotFoundError('Event registration not found');

  await repo.deleteOneById(params.registrationId, user.id);

  ctx.set('auditResourceId', params.registrationId);
  ctx.set('auditDescription', 'Event registration deleted');

  return ctx.json({ success: true }, 200);
}
