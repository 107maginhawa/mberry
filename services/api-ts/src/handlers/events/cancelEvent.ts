import type { Context } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import { notifications } from '../notifs/repos/notification.schema';
import { eventRegistrations } from '../association:operations/repos/events.schema';
import { SYSTEM_USER_ID } from '@/core/constants';
import type { Session } from '@/types/auth';

export async function cancelEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const repo = new EventsRepository(db);
  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Event not found');
  if (existing.status === 'cancelled') {
    throw new BusinessLogicError('Event is already cancelled', 'EVENT_ALREADY_CANCELLED');
  }
  if (existing.status === 'completed') {
    throw new BusinessLogicError('Cannot cancel a completed event', 'EVENT_COMPLETED');
  }

  // Officer authorization — only officers can cancel events
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, existing.organizationId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to cancel events');
  }

  const updated = await repo.update(id, { status: 'cancelled' });

  domainEvents.emit('event.cancelled', {
    eventId: id,
    organizationId: existing.organizationId,
    cancelledBy: session.user.id,
  }).catch(() => {});

  // Cascade: cancel all active registrations and notify members
  (async () => {
    try {
      // Fetch all confirmed/waitlisted registrations
      const activeRegs = await db
        .select()
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, id),
            inArray(eventRegistrations.status, ['confirmed', 'waitlisted']),
          ),
        );

      if (activeRegs.length === 0) return;

      // Bulk update registrations to cancelled
      await db
        .update(eventRegistrations)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(
          and(
            eq(eventRegistrations.eventId, id),
            inArray(eventRegistrations.status, ['confirmed', 'waitlisted']),
          ),
        );

      // Bulk insert in-app notifications for each affected member
      const now = new Date();
      await db.insert(notifications).values(
        activeRegs.map((reg: { personId: string; id: string }) => ({
          organizationId: existing.organizationId,
          recipient: reg.personId,
          type: 'system' as const,
          channel: 'in-app' as const,
          title: 'Event Cancelled',
          message: `The event "${existing.title}" has been cancelled. If you paid a registration fee, a refund will be processed.`,
          status: 'sent' as const,
          sentAt: now,
          relatedEntityType: 'event',
          relatedEntity: id,
          consentValidated: false,
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        })),
      );

      // Emit per-registration domain events so refund consumers can react
      for (const reg of activeRegs) {
        domainEvents.emit('event.registration.cancelled', {
          registrationId: reg.id,
          eventId: id,
          personId: reg.personId,
          organizationId: existing.organizationId,
          hadPayment: (existing.registrationFee ?? 0) > 0,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[cancelEvent] cascade failed:', err);
    }
  })();

  return ctx.json({ data: updated }, 200);
}
