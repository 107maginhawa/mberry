import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';

export async function getEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new EventsRepository(db);
  const event = await repo.get(id);
  if (!event) throw new NotFoundError('Event not found');
  const regCount = await repo.getRegistrationCount(id);
  const attStats = await repo.getAttendanceStats(id);
  return ctx.json({ data: { ...event, registrationCount: regCount, attendance: attStats } }, 200);
}
