import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { NotificationService } from '@/core/notifs';
import type { CancelEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRegistrationRepository, WaitlistEntryRepository, EventRepository } from './repos/events.repo';
import { domainEvents } from '@/core/domain-events';
import { notifyLateCancellation } from '@/handlers/notifs/notification-triggers';

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
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'association:operations' }) ?? baseLogger;
  const repo = new EventRegistrationRepository(db, logger);

  const existing = await repo.findOneById(params.registrationId);
  if (!existing) throw new NotFoundError('Event registration not found');

  if (existing.status === 'cancelled') {
    throw new BusinessLogicError('Registration is already cancelled', 'ALREADY_CANCELLED');
  }

  const cancelled = await repo.updateOneById(params.registrationId, {
    status: 'cancelled',
    cancelledAt: new Date(),
  });

  domainEvents.emit('event.registration.cancelled', {
    registrationId: cancelled.id,
    eventId: existing.eventId,
    personId: existing.personId,
    organizationId: existing.organizationId,
    cancelledBy: user.id,
  }).catch(() => {});

  // [BR-27] Promote next waitlisted entry if a confirmed registration was cancelled
  if (existing.status === 'confirmed') {
    try {
      const waitlistRepo = new WaitlistEntryRepository(db, logger);
      const promoted = await waitlistRepo.promoteNext(existing.eventId);
      if (promoted) {
        await repo.createOne({
          eventId: existing.eventId,
          personId: promoted.personId,
          organizationId: existing.organizationId,
          status: 'confirmed',
        });
      }
    } catch (err) {
      logger?.warn({ action: 'cancelEventRegistration.1', error: err, eventId: existing.eventId }, 'Failed to promote waitlist entry after cancellation');
    }
  }

  ctx.set('auditResourceId', cancelled.id);
  ctx.set('auditDescription', 'Event registration cancelled');

  // GAP-006: Notify organizers of late cancellation (within 24h of event)
  const notifService = ctx.get('notifs') as NotificationService;
  if (notifService && existing.eventId) {
    try {
      const eventRepo = new EventRepository(db, logger);
      const event = await eventRepo.findOneById(existing.eventId);
      if (event) {
        const hoursUntilEvent = (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilEvent <= 24) {
          // Resolve the event organizer from the event record.
          // event.createdBy comes from baseEntityFields and is set when the event is created.
          const organizerIds = event.createdBy ? [event.createdBy] : [];
          if (organizerIds.length > 0) {
            const orgId = ctx.get('organizationId') || existing.organizationId;
            await notifyLateCancellation(notifService, {
              organizationId: orgId,
              cancellerId: user.id,
              organizerIds,
              eventId: existing.eventId,
              eventName: event.title,
              cancelledAt: new Date(),
              eventStartsAt: event.startDate,
            });
          } else {
            logger?.warn({ action: 'cancelEventRegistration.2', eventId: existing.eventId }, 'Skipping late-cancellation notification: event has no createdBy organizer');
          }
        }
      }
    } catch (err) {
      logger?.warn({ action: 'cancelEventRegistration.3', error: err, eventId: existing.eventId }, 'Failed to send late cancellation notification');
    }
  }

  return ctx.json(cancelled, 200);
}
