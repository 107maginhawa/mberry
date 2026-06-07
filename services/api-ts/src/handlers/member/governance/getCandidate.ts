import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { GetCandidateParams } from '@/generated/openapi/validators';
import { electionNominees } from '@/handlers/elections/repos/elections.schema';
import { eq } from 'drizzle-orm';

/**
 * getCandidate
 *
 * Path: GET /association/member/candidates/{candidateId}
 * OperationId: getCandidate
 */
export async function getCandidate(
  ctx: ValidatedContext<never, never, GetCandidateParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const [nominee] = await db
    .select()
    .from(electionNominees)
    .where(eq(electionNominees.id, params.candidateId))
    .limit(1);

  if (!nominee) throw new NotFoundError('Candidate');

  return ctx.json({ data: nominee }, 200);
}
