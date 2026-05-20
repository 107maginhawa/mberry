import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { NotificationService } from '@/core/notifs';
import type { CancelEventRegistrationParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRegistrationRepository, WaitlistEntryRepository, EventRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';
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
  const logger = ctx.get('logger');
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
      logger?.warn({ error: err, eventId: existing.eventId }, 'Failed to promote waitlist entry after cancellation');
    }
  }

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'event-registration',
    resourceId: cancelled.id,
    description: 'Event registration cancelled',
  });

  // GAP-006: Notify organizers of late cancellation (within 24h of event)
  const notifService = ctx.get('notifs') as NotificationService;
  if (notifService && existing.eventId) {
    try {
      const eventRepo = new EventRepository(db, logger);
      const event = await eventRepo.findOneById(existing.eventId);
      if (event) {
        const hoursUntilEvent = (event.startDate.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilEvent <= 24) {
          const orgId = ctx.get('organizationId') || existing.organizationId;
          await notifyLateCancellation(notifService, {
            organizationId: orgId,
            cancellerId: user.id,
            organizerIds: [user.id], // TODO: resolve actual organizer from event.createdBy once schema supports it
            eventId: existing.eventId,
            eventName: event.title,
            cancelledAt: new Date(),
            eventStartsAt: event.startDate,
          });
        }
      }
    } catch (err) {
      logger?.warn({ error: err, eventId: existing.eventId }, 'Failed to send late cancellation notification');
    }
  }

  return ctx.json(cancelled, 200);
}
