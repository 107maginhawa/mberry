import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { MyBallotsQuery } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';

/**
 * myBallots
 *
 * Path: GET /association/member/ballots/mine
 * OperationId: myBallots
 *
 * AHA FIX-003 (G3): member self-read of their OWN ballots. The voter filter is the
 * authenticated session user — never a client-supplied id — so a member can only ever
 * see their own votes. This powers the "already voted?" check without the admin-only
 * `listBallots` 403'ing the member (which silently caused DUPLICATE_VOTE resubmits).
 */
export async function myBallots(
  ctx: ValidatedContext<never, MyBallotsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const user = ctx.get('user');
  const voterId = user?.id;
  if (!voterId) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  if (!query.electionId) return ctx.json({ data: [] }, 200);

  const items = await repo.listVotesForVoter(query.electionId, voterId);
  return ctx.json({ data: items }, 200);
}
