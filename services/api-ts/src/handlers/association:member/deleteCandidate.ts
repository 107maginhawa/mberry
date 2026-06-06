import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DeleteCandidateParams } from '@/generated/openapi/validators';
import { electionNominees } from '../elections/repos/elections.schema';
import { eq } from 'drizzle-orm';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * deleteCandidate
 *
 * Path: DELETE /association/member/candidates/{candidateId}
 * OperationId: deleteCandidate
 */
export async function deleteCandidate(
  ctx: ValidatedContext<never, never, DeleteCandidateParams>
): Promise<Response> {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const [existing] = await db
    .select()
    .from(electionNominees)
    .where(eq(electionNominees.id, params.candidateId))
    .limit(1);

  if (!existing) throw new NotFoundError('Candidate');

  await db.delete(electionNominees).where(eq(electionNominees.id, params.candidateId));

  ctx.set('auditResourceId', params.candidateId);
  ctx.set('auditDescription', 'Nominee removed from election');

  return ctx.json({ success: true }, 200);
}
