import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';

export async function listAttendance(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const eventId = ctx.req.param('id')!;
  const repo = new EventsRepository(db);
  const attendance = await repo.listAttendance(eventId);
  const stats = await repo.getAttendanceStats(eventId);
  return ctx.json({ data: attendance, meta: stats }, 200);
}
