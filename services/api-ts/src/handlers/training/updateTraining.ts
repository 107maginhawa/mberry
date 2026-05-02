import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import type { Session } from '@/types/auth';

export async function updateTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Training not found');
  // TODO(org-scoping): routes under /training/:id have no orgId param. Auth middleware
  // restricts access by session, but cross-org data leakage is possible if IDs are
  // guessed. Add orgId to the route and pass it to repo.get() once route is updated.

  // Strip fields not in new schema
  const {
    type: _type,
    scheduleDescription: _scheduleDescription,
    locationType: _locationType,
    locationDetails,
    coverImage: _coverImage,
    creditValueLocked: _creditValueLocked,
    regulatoryApproval: _regulatoryApproval,
    regulatoryReference: _regulatoryReference,
    enrollmentMode: _enrollmentMode,
    visibility: _visibility,
    startAt,
    endAt,
    creditValue,
    fee,
    ...rest
  } = body;

  const updated = await repo.update(id, {
    ...rest,
    ...(locationDetails !== undefined && { location: locationDetails }),
    ...(fee !== undefined && { registrationFee: fee }),
    ...(creditValue !== undefined && { creditAmount: creditValue }),
    startDate: startAt ? new Date(startAt) : (body.startDate ? new Date(body.startDate) : undefined),
    endDate: endAt ? new Date(endAt) : (body.endDate ? new Date(body.endDate) : undefined),
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
