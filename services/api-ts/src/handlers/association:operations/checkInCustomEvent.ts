import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CheckInCustomEventBody, CheckInCustomEventParams } from '@/generated/openapi/validators';
import { EventRepository, CheckInRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

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

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const eventRepo = new EventRepository(db, logger);
  const checkInRepo = new CheckInRepository(db, logger);

  const event = await eventRepo.findOneById(params.eventId);
  if (!event) throw new NotFoundError('Event not found');

  const personId = body.personId || user.id;
  const method = body.method || 'manual';

  const orgId = ctx.get('organizationId') || event.organizationId;

  // Duplicate check-in prevention
  const existing = await checkInRepo.findMany({ eventId: params.eventId, personId });
  if (existing.length > 0) {
    throw new BusinessLogicError('Person already checked in for this event', 'DUPLICATE_CHECK_IN');
  }

  const checkIn = await checkInRepo.createOne({
    eventId: params.eventId,
    personId,
    method: method as string as 'manual' | 'qr',
    checkedInBy: user.id,
    organizationId: orgId,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'check-in',
    resourceId: checkIn.id,
    description: `Checked in to event via ${method}`,
  });

  return ctx.json(checkIn, 201);
}
