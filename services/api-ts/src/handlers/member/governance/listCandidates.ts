import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListCandidatesQuery } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';

/**
 * listCandidates
 *
 * Path: GET /association/member/candidates
 * OperationId: listCandidates
 */
export async function listCandidates(
  ctx: ValidatedContext<never, ListCandidatesQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const items = await repo.listNominees(query.electionId ?? '');

  return ctx.json({ data: items }, 200);
}
