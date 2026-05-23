import type { Context } from 'hono';
import { ValidationError } from '@/core/errors';
import { EventsRepository } from './repos/events.repo';
import { generateEventSlug, ensureUniqueEventSlug } from './utils/event-slug';
import type { Session } from '@/types/auth';

export async function createEvent(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId');
  const body = await ctx.req.json();
  const repo = new EventsRepository(db);

  // Validate credit hours: 0.5 increments, max 40
  const creditAmount = body.creditAmount ?? 0;
  if (creditAmount > 40) {
    throw new ValidationError('Credit amount cannot exceed 40 hours');
  }
  if (creditAmount > 0 && (creditAmount * 2) % 1 !== 0) {
    throw new ValidationError('Credit amount must be in 0.5 increments');
  }

  // Auto-generate slug from title on first save (immutable after)
  const baseSlug = generateEventSlug(body.title);
  const eventSlug = baseSlug
    ? await ensureUniqueEventSlug(baseSlug, repo)
    : undefined;

  const event = await repo.create({
    organizationId: orgId,
    title: body.title,
    eventType: body.eventType ?? 'other',
    description: body.description,
    location: body.location ?? body.locationDetails,
    startDate: new Date(body.startAt ?? body.startDate),
    endDate: new Date(body.endAt ?? body.endDate),
    registrationFee: body.fee ?? body.registrationFee ?? 0,
    currency: body.currency ?? 'PHP',
    capacity: body.capacity,
    creditBearing: body.creditBearing ?? false,
    creditAmount,
    cpdActivityType: body.cpdActivityType ?? null,
    eventSlug,
    coverImageUrl: body.coverImageUrl ?? null,
    status: body.status ?? 'draft',
    visibility: body.visibility ?? 'internal',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: event }, 201);
}
