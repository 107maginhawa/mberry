import type { Context } from 'hono';
import { NotFoundError, ForbiddenError, UnauthorizedError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import type { Session } from '@/types/auth';

export async function listAttendance(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const eventId = ctx.req.param('id')!;
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

  // Membership check — only org members can view attendance
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.getMember(event.organizationId, session.user.id);
  if (!membership) throw new ForbiddenError('Access denied');

  const attendance = await repo.listAttendance(eventId);
  const stats = await repo.getAttendanceStats(eventId);
  return ctx.json({ data: attendance, meta: stats }, 200);
}
