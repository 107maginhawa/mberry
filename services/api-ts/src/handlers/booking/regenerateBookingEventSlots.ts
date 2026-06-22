/**
 * Regenerate Booking Event Slots Handler
 *
 * Manual trigger for slot (re)generation on a single booking event. Mirrors the
 * ownership + regeneration behavior of updateBookingEvent's slot-regen path, but
 * without requiring a config change — used to recover availability after a
 * schedule edit or a missed `booking.slotGenerator` cron run.
 *
 * Path: POST /booking/events/{event}/regenerate-slots
 * OperationId: regenerateBookingEventSlots
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { ValidationError } from '@/core/errors';
import type { RegenerateBookingEventSlotsParams } from '@/generated/openapi/validators';
import { BookingEventRepository } from './repos/bookingEvent.repo';
import { regenerateEventSlots } from './jobs/slotGenerator';

export async function regenerateBookingEventSlots(
  ctx: ValidatedContext<never, never, RegenerateBookingEventSlotsParams>
): Promise<Response> {
  // Get authenticated user
  const user = ctx.get('user') as User;

  // Get path parameter (event id)
  const { event: eventId } = ctx.req.param();
  if (!eventId) {
    throw new ValidationError('Event ID is required');
  }

  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'booking' }) ?? baseLogger;

  const repo = new BookingEventRepository(db, logger);

  try {
    // Load + ownership check (mirrors updateBookingEvent: event:owner / admin)
    const existingEvent = await repo.findOneById(eventId);
    if (!existingEvent) {
      return ctx.json({ error: 'Booking event not found' }, 404);
    }
    if (existingEvent.owner !== user.id) {
      return ctx.json({ error: 'Access denied' }, 403);
    }

    // Regenerate slots from the event's current schedule. The job no-ops for a
    // non-active event (logs + returns) — surfaced to the caller as an unchanged
    // event rather than an error. Errors propagate to the client.
    await regenerateEventSlots(db, eventId);
    logger?.info(
      { action: 'regenerateBookingEventSlots.1', eventId, ownerId: existingEvent.owner, triggeredBy: user.id },
      'Booking event slots regenerated (manual trigger)',
    );

    // Return the (possibly re-read) event so the client gets fresh state.
    const event = (await repo.findOneById(eventId)) ?? existingEvent;
    return ctx.json(event);
  } catch (error) {
    logger?.error({ action: 'regenerateBookingEventSlots.2', error, eventId }, 'Failed to regenerate booking event slots');
    return ctx.json({ error: 'Failed to regenerate booking event slots' }, 500);
  }
}
