import type { Context } from 'hono';
import { NotFoundError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import type { Session } from '@/types/auth';

export async function cancelEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const repo = new EventsRepository(db);
  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Event not found');
  if (existing.status === 'cancelled') {
    throw new BusinessLogicError('Event is already cancelled', 'EVENT_ALREADY_CANCELLED');
  }
  if (existing.status === 'completed') {
    throw new BusinessLogicError('Cannot cancel a completed event', 'EVENT_COMPLETED');
  }
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.getMember(existing.organizationId, session.user.id);
  if (!membership) throw new ForbiddenError('Access denied to this resource');
  const updated = await repo.update(id, { status: 'cancelled' });
  return ctx.json({ data: updated }, 200);
}
