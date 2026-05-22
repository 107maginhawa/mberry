import type { Context } from 'hono';
import { NotFoundError, ConflictError, ForbiddenError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import type { Session } from '@/types/auth';

export async function checkIn(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;

  // Only officers can perform check-ins
  const orgId = ctx.get('organizationId');
  if (orgId) {
    const officerRepo = new OfficerTermRepository(db);
    const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
    if (terms.length === 0) {
      throw new ForbiddenError('Officer access required to perform check-ins');
    }
  }

  const eventId = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new EventsRepository(db);

  const event = await repo.get(eventId);
  if (!event) throw new NotFoundError('Event not found');

  const alreadyCheckedIn = await repo.isCheckedIn(eventId, body.personId);
  if (alreadyCheckedIn) throw new ConflictError('Already checked in');

  const attendance = await repo.checkIn({
    eventId,
    personId: body.personId,
    method: body.method ?? 'manual',
    checkedInBy: session.user.id,
    organizationId: event.organizationId,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: attendance }, 201);
}
