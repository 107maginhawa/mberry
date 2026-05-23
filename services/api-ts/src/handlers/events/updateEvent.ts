import type { Context } from 'hono';
import { NotFoundError, ForbiddenError, BusinessLogicError, ValidationError } from '@/core/errors';
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

  // Status can only be changed via dedicated endpoints (publish, cancel, complete)
  if (body.status !== undefined) {
    throw new BusinessLogicError(
      'Status cannot be changed via update. Use publish, cancel, or complete endpoints.',
      'STATUS_UPDATE_NOT_ALLOWED'
    );
  }

  // Slug is immutable after first save
  if (body.eventSlug !== undefined) {
    throw new BusinessLogicError(
      'Event slug cannot be changed after creation.',
      'SLUG_IMMUTABLE'
    );
  }

  // Validate credit hours if provided
  if (body.creditAmount !== undefined && body.creditAmount !== null) {
    if (body.creditAmount > 40) {
      throw new ValidationError('Credit amount cannot exceed 40 hours');
    }
    if (body.creditAmount > 0 && (body.creditAmount * 2) % 1 !== 0) {
      throw new ValidationError('Credit amount must be in 0.5 increments');
    }
  }

  // Map old field names to new schema columns; omit fields not in schema
  const {
    type: _type,
    locationType: _locationType,
    locationDetails,
    coverImage: _coverImage,
    qrEnabled: _qrEnabled,
    registrationEnabled: _registrationEnabled,
    status: _status,
    eventSlug: _eventSlug,
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
