import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import type { Session } from '@/types/auth';

export async function updateEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new EventsRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Event not found');
  // TODO(org-scoping): routes under /events/:id have no orgId param. Auth middleware
  // restricts access by session, but cross-org data leakage is possible if IDs are
  // guessed. Add orgId to the route and pass it to repo.get() once route is updated.

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
