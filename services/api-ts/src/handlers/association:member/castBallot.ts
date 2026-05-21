import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CastBallotBody } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * castBallot
 *
 * Path: POST /association/member/ballots
 * OperationId: castBallot
 *
 * BR-33: Only active members may vote
 * BR-34: Nominee must belong to this election and match the voted position
 */
export async function castBallot(
  ctx: ValidatedContext<CastBallotBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const election = await repo.get(body.electionId);
  if (!election) throw new NotFoundError('Election');

  if (election.status !== 'votingOpen') {
    throw new BusinessLogicError('Election is not open for voting', 'ELECTION_NOT_OPEN');
  }

  const user = ctx.get('user');
  const voterId = user?.id;
  if (!voterId) throw new UnauthorizedError();

  // BR-33: Voter must be an active member of this organization
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.findByPersonAndOrg(voterId, election.organizationId);
  if (!membership || membership.status !== 'active') {
    throw new BusinessLogicError(
      'Only active members are eligible to vote',
      'VOTER_NOT_ELIGIBLE',
    );
  }

  // BR-34: Nominee must exist
  const nominee = await repo.getNominee(body.candidateId);
  if (!nominee) {
    throw new BusinessLogicError(
      'Nominee not found',
      'NOMINEE_NOT_FOUND',
    );
  }

  // BR-34: Nominee must belong to this election
  if (nominee.electionId !== body.electionId) {
    throw new BusinessLogicError(
      'Nominee does not belong to this election',
      'NOMINEE_NOT_IN_ELECTION',
    );
  }

  // BR-34: Nominee must be running for the voted position
  if (nominee.positionId !== body.positionId) {
    throw new BusinessLogicError(
      'Nominee is not running for this position',
      'NOMINEE_WRONG_POSITION',
    );
  }

  // Check for duplicate vote
  const alreadyVoted = await repo.hasVoted(body.electionId, voterId, body.positionId);
  if (alreadyVoted) {
    throw new BusinessLogicError('You have already voted for this position in this election', 'DUPLICATE_VOTE');
  }

  const vote = await repo.castVote({
    electionId: body.electionId,
    positionId: body.positionId,
    nomineeId: body.candidateId,
    voterId,
    organizationId: election.organizationId,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'election-vote',
    resourceId: vote.id,
    description: `Ballot cast in election ${body.electionId}`,
    details: { electionId: body.electionId, positionId: body.positionId },
    eventSubType: 'governance.vote-cast',
  });

  return ctx.json({ data: vote }, 201);
}
