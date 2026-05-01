import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateEventRegistrationBody } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRepository, EventRegistrationRepository, WaitlistEntryRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';

/**
 * createEventRegistration
 *
 * Path: POST /association/events/registrations
 * OperationId: createEventRegistration
 *
 * Business rules:
 * - Check event exists and is published
 * - Check capacity; auto-waitlist if full
 */
export async function createEventRegistration(
  ctx: ValidatedContext<CreateEventRegistrationBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const eventRepo = new EventRepository(db, logger);
  const regRepo = new EventRegistrationRepository(db, logger);
  const waitlistRepo = new WaitlistEntryRepository(db, logger);

  const eventId = (body as any).eventId;
  const personId = (body as any).personId || user.id;

  const event = await eventRepo.findOneById(eventId);
  if (!event) throw new NotFoundError('Event not found');

  if (event.status !== 'published') {
    throw new BusinessLogicError('Registrations are only accepted for published events', 'EVENT_NOT_PUBLISHED');
  }

  // Check capacity
  if (event.capacity) {
    const confirmedCount = await regRepo.count({ tenantId, eventId, status: 'confirmed' });
    if (confirmedCount >= event.capacity) {
      // Auto-waitlist
      const position = await waitlistRepo.nextPosition(eventId);
      const entry = await waitlistRepo.createOne({
        tenantId,
        eventId,
        personId,
        position,
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
    tenantId,
    eventId,
    personId,
    status: 'confirmed',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'event-registration',
    resourceId: registration.id,
    description: 'Event registration created',
  });

  return ctx.json(registration, 201);
}
