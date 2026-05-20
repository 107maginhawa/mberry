import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { checkActiveMembership } from './utils/membership-check';
import type { Session } from '@/types/auth';

export async function registerForEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const eventId = ctx.req.param('id');
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

  // [M8-R1] Block direct registration for paid events — requires payment gateway
  if (event.registrationFee && event.registrationFee > 0) {
    throw new BusinessLogicError(
      'Paid event requires payment before registration. Use the payment gateway.',
      'PAYMENT_REQUIRED'
    );
  }

  // [BR-02] Only active members can register for events
  const isActive = await checkActiveMembership(db, session.user.id, event.organizationId);
  if (!isActive) {
    throw new BusinessLogicError('Active membership required to register for events');
  }

  const regCount = await repo.getRegistrationCount(eventId);
  const isWaitlisted = event.capacity ? regCount >= event.capacity : false;

  const registration = await repo.register({
    eventId,
    personId: session.user.id,
    status: isWaitlisted ? 'waitlisted' : 'confirmed',
    organizationId: event.organizationId,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: registration }, 201);
}
