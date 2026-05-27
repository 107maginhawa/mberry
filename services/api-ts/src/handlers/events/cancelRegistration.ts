import type { Context } from 'hono';
import { NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import type { Session } from '@/types/auth';

export async function cancelRegistration(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const eventId = ctx.req.param('eventId')!;
  const registrationId = ctx.req.param('registrationId')!;
  const orgId = ctx.req.param('orgId')!;

  const repo = new EventsRepository(db);

  // Validate the event exists and belongs to the org
  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');
  if (event.organizationId !== orgId) throw new NotFoundError('Event not found in this organization');

  // Validate the registration exists and belongs to this event
  const registration = await repo.getRegistration(registrationId);
  if (!registration) throw new NotFoundError('Registration not found');
  if (registration.eventId !== eventId) throw new NotFoundError('Registration does not belong to this event');

  if (registration.status === 'cancelled') {
    throw new BusinessLogicError('Registration is already cancelled', 'ALREADY_CANCELLED');
  }

  // Authorization: registrant themselves, or an officer of the org
  const isSelf = registration.personId === session.user.id;
  if (!isSelf) {
    const officerRepo = new OfficerTermRepository(db);
    const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
    if (terms.length === 0) {
      throw new ForbiddenError('Access denied: must be the registrant or an officer');
    }
  }

  const wasConfirmed = registration.status === 'confirmed';

  const cancelled = await repo.updateRegistration(registrationId, {
    status: 'cancelled',
    cancelledAt: new Date(),
  });

  domainEvents.emit('event.registration.cancelled', {
    registrationId: cancelled.id,
    eventId,
    personId: registration.personId,
    organizationId: orgId,
    cancelledBy: session.user.id,
  }).catch(() => {});

  // [BR-27] Promote next waitlisted registrant if a confirmed spot was freed
  if (wasConfirmed) {
    try {
      const next = await repo.getFirstWaitlisted(eventId);
      if (next) {
        await repo.updateRegistration(next.id, { status: 'confirmed' });
      }
    } catch {
      // Non-fatal: waitlist promotion failure should not block cancellation
    }
  }

  return ctx.json({ data: cancelled }, 200);
}
