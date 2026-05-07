import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { CheckInCustomEventBody, CheckInCustomEventParams } from '@/generated/openapi/validators';
import { EventRepository, CheckInRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';

/**
 * checkInCustomEvent
 *
 * Path: POST /association/event-lifecycle/{eventId}/check-in
 * OperationId: checkInCustomEvent
 */
export async function checkInCustomEvent(
  ctx: ValidatedContext<CheckInCustomEventBody, never, CheckInCustomEventParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const eventRepo = new EventRepository(db, logger);
  const checkInRepo = new CheckInRepository(db, logger);

  const event = await eventRepo.findOneById(params.eventId);
  if (!event) throw new NotFoundError('Event not found');

  const personId = (body as any).personId || user.id;
  const method = (body as any).method || 'manual';

  const checkIn = await checkInRepo.createOne({
    eventId: params.eventId,
    personId,
    method,
    checkedInBy: user.id,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'check-in',
    resourceId: checkIn.id,
    description: `Checked in to event via ${method}`,
  });

  return ctx.json(checkIn, 201);
}
