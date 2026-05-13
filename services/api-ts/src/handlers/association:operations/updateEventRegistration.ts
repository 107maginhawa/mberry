import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateEventRegistrationBody, UpdateEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRegistrationRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

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

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRegistrationRepository(db, logger);

  const existing = await repo.findOneById((params as any).registrationId);
  if (!existing) throw new NotFoundError('Event registration not found');

  const updated = await repo.updateOneById((params as any).registrationId, body as any);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'event-registration',
    resourceId: updated.id,
    description: 'Event registration updated',
  });

  return ctx.json(updated, 200);
}
