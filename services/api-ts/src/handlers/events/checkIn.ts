import type { Context } from 'hono';
import { NotFoundError, ConflictError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';

export async function checkIn(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const eventId = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

  const alreadyCheckedIn = await repo.isCheckedIn(eventId, body.personId);
  if (alreadyCheckedIn) throw new ConflictError('Already checked in');

  const attendance = await repo.checkIn({
    eventId,
    personId: body.personId,
    method: body.method ?? 'manual',
    createdBy: body.personId,
    updatedBy: body.personId,
  });

  return ctx.json({ data: attendance }, 201);
}
