import type { Context } from 'hono';
import { NotFoundError, ForbiddenError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import type { Session } from '@/types/auth';

export async function updateEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new EventsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Event not found');
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.getMember(existing.organizationId, session.user.id);
  if (!membership) throw new ForbiddenError('Access denied to this resource');

  // Map old field names to new schema columns; omit fields not in schema
  const {
    type: _type,
    locationType: _locationType,
    locationDetails,
    coverImage: _coverImage,
    qrEnabled: _qrEnabled,
    registrationEnabled: _registrationEnabled,
    startAt,
    endAt,
    fee,
    ...rest
  } = body;

  const updated = await repo.update(id, {
    ...rest,
    ...(locationDetails !== undefined && { location: locationDetails }),
    ...(fee !== undefined && { registrationFee: fee }),
    startDate: startAt ? new Date(startAt) : (body.startDate ? new Date(body.startDate) : undefined),
    endDate: endAt ? new Date(endAt) : (body.endDate ? new Date(body.endDate) : undefined),
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
