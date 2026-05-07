import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { GetElectionParams } from '@/generated/openapi/validators';
import { ElectionsRepository } from '../elections/repos/elections.repo';

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

  return ctx.json({ data: election }, 200);
}
