import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import type { Session } from '@/types/auth';

export async function updateTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const existing = await repo.getByOrg(id, orgId);
  if (!existing) throw new NotFoundError('Training not found');

  // Strip fields not in new schema (keep regulatory fields for SO-8)
  const {
    type: _type,
    scheduleDescription: _scheduleDescription,
    locationType: _locationType,
    locationDetails,
    coverImage: _coverImage,
    creditValueLocked: _creditValueLocked,
    enrollmentMode: _enrollmentMode,
    visibility: _visibility,
    regulatoryApproval,
    regulatoryReference,
    regulatoryExpiresAt,
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
    ...(regulatoryApproval !== undefined && { regulatoryApproval }),
    ...(regulatoryReference !== undefined && { regulatoryReference }),
    ...(regulatoryExpiresAt !== undefined && { regulatoryExpiresAt: new Date(regulatoryExpiresAt) }),
    startDate: startAt ? new Date(startAt) : (body.startDate ? new Date(body.startDate) : undefined),
    endDate: endAt ? new Date(endAt) : (body.endDate ? new Date(body.endDate) : undefined),
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
