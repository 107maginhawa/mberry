import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';

export async function cancelEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new EventsRepository(db);
  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Event not found');
  const updated = await repo.update(id, { status: 'cancelled' });
  return ctx.json({ data: updated }, 200);
}
