import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';

export async function listRegistrations(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const eventId = ctx.req.param('id')!;
  const limit = parseInt(ctx.req.query('limit') ?? '50', 10);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);
  const repo = new EventsRepository(db);
  const registrations = await repo.listRegistrations(eventId, { limit, offset });
  return ctx.json({ data: registrations, meta: { limit, offset } }, 200);
}
