import type { Context } from 'hono';
import { NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
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

  return ctx.json({ data: updated }, 200);
}
