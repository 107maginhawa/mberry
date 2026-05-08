import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { RegisterForCustomEventParams } from '@/generated/openapi/validators';
import { EventRepository, EventRegistrationRepository, WaitlistEntryRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';

/**
 * registerForCustomEvent
 *
 * Path: POST /association/event-lifecycle/{eventId}/register
 * OperationId: registerForCustomEvent
 */
export async function registerForCustomEvent(
  ctx: ValidatedContext<never, never, RegisterForCustomEventParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const eventRepo = new EventRepository(db, logger);
  const regRepo = new EventRegistrationRepository(db, logger);
  const waitlistRepo = new WaitlistEntryRepository(db, logger);

  const event = await eventRepo.findOneById(params.eventId);
  if (!event) throw new NotFoundError('Event not found');

  if (event.status !== 'published') {
    throw new BusinessLogicError('Registrations are only accepted for published events', 'EVENT_NOT_PUBLISHED');
  }

  if (event.capacity) {
    const confirmedCount = await regRepo.count({ eventId: params.eventId, status: 'confirmed' });
    if (confirmedCount >= event.capacity) {
      const position = await waitlistRepo.nextPosition(params.eventId);
      const entry = await waitlistRepo.createOne({
        eventId: params.eventId,
        personId: user.id,
        position,
        organizationId: orgId,
      });

      await auditAction(ctx, {
        action: 'create',
        resourceType: 'waitlist-entry',
        resourceId: entry.id,
        description: 'Auto-waitlisted due to capacity',
      });

      return ctx.json({ ...entry, waitlisted: true }, 201);
    }
  }

  const registration = await regRepo.createOne({
    eventId: params.eventId,
    personId: user.id,
    status: 'confirmed',
    organizationId: orgId,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'event-registration',
    resourceId: registration.id,
    description: 'Registered for event',
  });

  return ctx.json(registration, 201);
}
