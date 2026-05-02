import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';
import type { Session } from '@/types/auth';

export async function listMyEvents(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const repo = new EventsRepository(db);
  const myEvents = await repo.listByPerson(session.user.id);
  return ctx.json({ data: myEvents }, 200);
}
