import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';

export async function listRegistrations(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const eventId = ctx.req.param('id')!;
  const repo = new EventsRepository(db);
  const registrations = await repo.listRegistrations(eventId);
  return ctx.json({ data: registrations }, 200);
}
