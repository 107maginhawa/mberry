import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';

export async function listAttendance(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const eventId = ctx.req.param('id')!;
  const limit = parseInt(ctx.req.query('limit') ?? '50', 10);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);
  const repo = new EventsRepository(db);
  const attendance = await repo.listAttendance(eventId, { limit, offset });
  const stats = await repo.getAttendanceStats(eventId);
  return ctx.json({ data: attendance, meta: { ...stats, limit, offset } }, 200);
}
