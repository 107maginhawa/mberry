import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CastBallotBody } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';
import { auditAction } from '@/utils/audit';

/**
 * castBallot
 *
 * Path: POST /association/member/ballots
 * OperationId: castBallot
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
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'election-vote',
    resourceId: vote.id,
    description: `Ballot cast in election ${body.electionId}`,
    details: { electionId: body.electionId, positionId: body.positionId },
  });

  return ctx.json({ data: vote }, 201);
}
