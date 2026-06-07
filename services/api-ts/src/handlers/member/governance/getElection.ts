import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { GetElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';

/**
 * getElection
 *
 * Path: GET /association/member/elections/{electionId}
 * OperationId: getElection
 */
export async function getElection(
  ctx: ValidatedContext<never, never, GetElectionParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const election = await repo.get(params.electionId);
  if (!election) throw new NotFoundError('Election');

  const nominees = await repo.listNominees(params.electionId);
  const voterCount = await repo.getVoterCount(params.electionId);
  const tallies = election.status === 'awaitingConfirmation' || election.status === 'published'
    ? await repo.getVoteTallies(params.electionId) : [];

  return ctx.json({ data: {
    ...election,
    // Map DB → TypeSpec field names for SDK transformer
    nominationStart: election.nominationsOpenAt,
    nominationEnd: election.nominationsCloseAt,
    votingStart: election.votingOpenAt,
    votingEnd: election.votingCloseAt,
    nominees,
    voterCount,
    tallies,
  } }, 200);
}
