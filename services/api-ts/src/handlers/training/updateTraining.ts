import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError, ForbiddenError, ValidationError } from '@/core/errors';

const VALID_TRAINING_TYPES = ['seminar', 'workshop', 'convention', 'onlineCourse', 'skillsTraining'] as const;
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import type { Session } from '@/types/auth';

export async function updateTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const orgId = ctx.req.param('organizationId')!;

  // [P0-AUTH] Officer role check — only officers can update training
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to update training');
  }

  const body = await ctx.req.json();

  // [M9-R1] Enforce platform-defined training types — not org-customizable
  if (body.trainingType !== undefined && !VALID_TRAINING_TYPES.includes(body.trainingType)) {
    throw new ValidationError(
      `Invalid training type "${body.trainingType}". Must be one of: ${VALID_TRAINING_TYPES.join(', ')}`
    );
  }

  const repo = new TrainingRepository(db);

  const existing = await repo.getByOrg(id, orgId);
  if (!existing) throw new NotFoundError('Training not found');

  // Status can only be changed via dedicated endpoints (publish, cancel, complete)
  if (body.status !== undefined) {
    throw new BusinessLogicError(
      'Status cannot be changed via update. Use publish, cancel, or complete endpoints.',
      'STATUS_UPDATE_NOT_ALLOWED'
    );
  }

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
    status: _status,
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
