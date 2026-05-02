import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';
import type { Session } from '@/types/auth';

export async function createEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new EventsRepository(db);

  const event = await repo.create({
    organizationId: orgId,
    title: body.title,
    type: body.type,
    description: body.description,
    startAt: new Date(body.startAt),
    endAt: new Date(body.endAt),
    locationType: body.locationType ?? 'in_person',
    locationDetails: body.locationDetails,
    coverImage: body.coverImage,
    registrationEnabled: body.registrationEnabled ?? true,
    fee: body.fee ?? 0,
    capacity: body.capacity,
    qrEnabled: body.qrEnabled ?? true,
    visibility: body.visibility ?? 'internal',
    status: body.status ?? 'draft',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: event }, 201);
}
