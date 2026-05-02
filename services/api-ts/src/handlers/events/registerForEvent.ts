import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import type { Session } from '@/types/auth';

export async function registerForEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const eventId = ctx.req.param('id');
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

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
