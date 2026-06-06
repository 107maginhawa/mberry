import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import type { UpdateCandidateStatusBody, UpdateCandidateStatusParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { OfficerTermRepository } from './repos/governance.repo';

const VALID_NOMINEE_TRANSITIONS: Record<string, string[]> = {
  nominated: ['accepted', 'declined'],
  accepted: ['declined'], // can withdraw after accepting
  declined: [], // terminal
  elected: [], // terminal — set by certifyElection
};

/**
 * updateCandidateStatus
 *
 * Path: POST /association/member/candidates/{candidateId}/status
 * OperationId: updateCandidateStatus
 *
 * A candidate (nominee) can accept or decline their nomination. The nominee
 * themselves or an officer of the org may update the status.
 */
export async function updateCandidateStatus(
  ctx: ValidatedContext<UpdateCandidateStatusBody, never, UpdateCandidateStatusParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const newStatus = body.status;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const nominee = await repo.getNominee(params.candidateId);
  if (!nominee) throw new NotFoundError('Candidate');

  const election = await repo.get(nominee.electionId);
  if (!election) throw new NotFoundError('Election');

  // Fix org context — middleware may have picked up candidateId UUID instead of orgId
  ctx.set('organizationId', election.organizationId);

  // Only the nominee themselves or an officer can update status
  const isSelf = nominee.personId === session.user.id;
  if (!isSelf) {
    const officerRepo = new OfficerTermRepository(db);
    const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, election.organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Only the candidate or an officer can update candidate status');
    }
  }

  const allowed = VALID_NOMINEE_TRANSITIONS[nominee.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new BusinessLogicError(
      `Cannot transition candidate from '${nominee.status}' to '${newStatus}'. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
      'INVALID_NOMINEE_TRANSITION',
    );
  }

  const updated = await repo.updateNomineeStatus(params.candidateId, newStatus);

  ctx.set('auditResourceId', params.candidateId);
  ctx.set('auditDescription', `Candidate status changed to ${newStatus}`);
  ctx.set('auditDetails', { electionId: election.id, fromStatus: nominee.status, toStatus: newStatus });

  return ctx.json({ data: updated }, 200);
}
