import type { Context } from 'hono';
import { TrainingRepository } from './repos/training.repo';
import type { Session } from '@/types/auth';

export async function createTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const training = await repo.create({
    organizationId: orgId,
    title: body.title,
    type: body.type,
    description: body.description,
    startAt: new Date(body.startAt),
    endAt: body.endAt ? new Date(body.endAt) : undefined,
    scheduleDescription: body.scheduleDescription,
    locationType: body.locationType ?? 'in_person',
    locationDetails: body.locationDetails,
    coverImage: body.coverImage,
    creditValue: String(body.creditValue ?? 0),
    regulatoryApproval: body.regulatoryApproval ?? 'not_applicable',
    regulatoryReference: body.regulatoryReference,
    enrollmentMode: body.enrollmentMode ?? 'open',
    fee: body.fee ?? 0,
    capacity: body.capacity,
    visibility: body.visibility ?? 'network',
    status: body.status ?? 'draft',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: training }, 201);
}
