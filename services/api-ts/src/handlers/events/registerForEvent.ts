import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '../association:member/repos/membership.repo';
import type { Session } from '@/types/auth';

export async function registerForEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const eventId = ctx.req.param('id');
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

  // [BR-02] Only active members can register for events
  const membershipRepo = new MembershipRepository(db, ctx.get('logger'));
  const membership = await membershipRepo.findByPersonAndOrg(session.user.id, event.organizationId);
  if (!membership || membership.status !== 'active') {
    throw new BusinessLogicError('Active membership required to register for events');
  }

  const regCount = await repo.getRegistrationCount(eventId);
  const isWaitlisted = event.capacity ? regCount >= event.capacity : false;

  const registration = await repo.register({
    tenantId: event.tenantId,
    eventId,
    personId: session.user.id,
    status: isWaitlisted ? 'waitlisted' : 'confirmed',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: registration }, 201);
}
