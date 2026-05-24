import type { Context } from 'hono';
import { TrainingRepository } from './repos/training.repo';
import type { Session } from '@/types/auth';

export async function createTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const training = await repo.create({
    organizationId: orgId,
    title: body.title,
    description: body.description,
    instructorName: body.instructorName,
    instructorId: body.instructorId,
    location: body.location ?? body.locationDetails,
    startDate: new Date(body.startAt ?? body.startDate),
    endDate: new Date(body.endAt ?? body.endDate),
    registrationFee: body.fee ?? body.registrationFee ?? 0,
    capacity: body.capacity,
    creditBearing: body.creditBearing ?? false,
    creditAmount: body.creditAmount ?? body.creditValue ?? 0,
    status: body.status ?? 'draft',
    prcAccreditationNumber: body.prcAccreditationNumber,
    accreditedProviderId: body.accreditedProviderId,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: training }, 201);
}
