import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError, UnauthorizedError, ForbiddenError } from '@/core/errors';
import { ElectionsRepository } from './repos/elections.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import type { Session } from '@/types/auth';

const VALID_NOMINEE_TRANSITIONS: Record<string, string[]> = {
  nominated: ['accepted', 'declined'],
  accepted: ['declined'],  // can withdraw after accepting
  declined: [],             // terminal
  elected: [],              // terminal — set by certifyElection
};

export async function updateNomineeStatus(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  if (!session) throw new UnauthorizedError();

  const electionId = ctx.req.param('electionId')!;
  const nomineeId = ctx.req.param('nomineeId')!;
  const body = await ctx.req.json();
  const newStatus = body.status as string;

  const repo = new ElectionsRepository(db);

  const election = await repo.get(electionId);
  if (!election) throw new NotFoundError('Election not found');

  const nominee = await repo.getNominee(nomineeId);
  if (!nominee) throw new NotFoundError('Nominee not found');

  // Only the nominee themselves or an officer can update status
  const isSelf = nominee.personId === session.user.id;
  if (!isSelf) {
    const officerRepo = new OfficerTermRepository(db);
    const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, election.organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Only the nominee or an officer can update nominee status');
    }
  }

  const allowed = VALID_NOMINEE_TRANSITIONS[nominee.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new BusinessLogicError(
      `Cannot transition nominee from '${nominee.status}' to '${newStatus}'. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
      'INVALID_NOMINEE_TRANSITION',
    );
  }

  const updated = await repo.updateNomineeStatus(nomineeId, newStatus);
  return ctx.json({ data: updated }, 200);
}
