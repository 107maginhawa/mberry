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
    tenantId: orgId,
    organizationId: orgId,
    title: body.title,
    description: body.description,
    location: body.location ?? body.locationDetails,
    startDate: new Date(body.startAt ?? body.startDate),
    endDate: new Date(body.endAt ?? body.endDate),
    registrationFee: body.fee ?? body.registrationFee ?? 0,
    capacity: body.capacity,
    creditBearing: body.creditBearing ?? false,
    creditAmount: body.creditAmount ?? 0,
    status: body.status ?? 'draft',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: event }, 201);
}
