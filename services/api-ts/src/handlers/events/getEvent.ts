import type { Context } from 'hono';
import { NotFoundError, ForbiddenError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import type { Session } from '@/types/auth';

export async function getEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const repo = new EventsRepository(db);
  const event = await repo.get(id);
  if (!event) throw new NotFoundError('Event not found');
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.getMember(event.organizationId, session.user.id);
  if (!membership) throw new ForbiddenError('Access denied to this resource');
  const regCount = await repo.getRegistrationCount(id);
  const attStats = await repo.getAttendanceStats(id);
  return ctx.json({ data: { ...event, registrationCount: regCount, attendance: attStats } }, 200);
}
