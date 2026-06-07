import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import {
  OfficerTermRepository,
  TransitionChecklistRepository,
} from './repos/governance.repo';
import { PersonRepository } from '@/handlers/person/repos/person.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import { domainEvents } from '@/core/domain-events';

/**
 * transitionOfficerTerm
 *
 * Path: POST /association/member/org/:organizationId/officers/:termId/transition
 *
 * M4-R3: Checklist-based officer handover workflow.
 * - Ends the outgoing term (status → 'completed', endDate → now)
 * - Creates a new term for the successor with the same position
 * - Optionally creates transition checklist items linked to the outgoing term
 * - Emits 'officer.transitioned' domain event
 */
export async function transitionOfficerTerm(
  ctx: ValidatedContext<any, never, { organizationId: string; termId: string }>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const { termId } = ctx.req.valid('param');
  const body = ctx.req.valid('json') as {
    successorPersonId: string;
    checklistItems?: string[];
  };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const termRepo = new OfficerTermRepository(db, logger);
  const checklistRepo = new TransitionChecklistRepository(db, logger);
  const personRepo = new PersonRepository(db, logger);

  // Validate outgoing term exists and belongs to this org
  const outgoingTerm = await termRepo.findById(termId);
  if (!outgoingTerm || outgoingTerm.organizationId !== orgId) {
    throw new NotFoundError('Officer term');
  }

  // Validate successor person exists
  const successor = await personRepo.findOneById(body.successorPersonId);
  if (!successor) {
    throw new NotFoundError('Successor person');
  }

  // End the outgoing term
  const now = new Date();
  await termRepo.update(termId, {
    status: 'completed',
    endDate: now,
  });

  // Create new term for successor with the same position
  const newTerm = await termRepo.create({
    organizationId: orgId,
    positionId: outgoingTerm.positionId,
    personId: body.successorPersonId,
    startDate: now,
    endDate: null,
    status: 'active',
    notes: null,
  });

  // Create transition checklist items if provided
  if (body.checklistItems && body.checklistItems.length > 0) {
    for (const item of body.checklistItems) {
      await checklistRepo.create({
        officerTermId: termId,
        organizationId: orgId,
        item,
        status: 'pending',
        completedAt: null,
        completedBy: null,
        notes: null,
      });
    }
  }

  ctx.set('auditResourceId', termId);
  ctx.set('auditDescription', 'Officer term transitioned to successor');
  ctx.set('auditDetails', {
      outgoingTermId: termId,
      newTermId: newTerm.id,
      successorPersonId: body.successorPersonId,
      positionId: outgoingTerm.positionId,
      checklistItemCount: body.checklistItems?.length ?? 0,
    });

  domainEvents.emit('officer.transitioned', {
    outgoingTermId: termId,
    newTermId: newTerm.id,
    outgoingPersonId: outgoingTerm.personId,
    successorPersonId: body.successorPersonId,
    positionId: outgoingTerm.positionId,
    organizationId: orgId,
    transitionedBy: user.id,
  }).catch(() => {});

  return ctx.json(newTerm, 201);
}
