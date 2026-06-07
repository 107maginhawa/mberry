import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListBallotsQuery } from '@/generated/openapi/validators';
import { electionVotes } from '@/handlers/elections/repos/elections.schema';
import { eq, and } from 'drizzle-orm';

/**
 * listBallots
 *
 * Path: GET /association/member/ballots
 * OperationId: listBallots
 */
export async function listBallots(
  ctx: ValidatedContext<never, ListBallotsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;

  const conditions = [];
  if (query.electionId) conditions.push(eq(electionVotes.electionId, query.electionId));
  if (query.positionId) conditions.push(eq(electionVotes.positionId, query.positionId));

  const baseQuery = db.select().from(electionVotes);
  const items = conditions.length > 0
    ? await baseQuery.where(and(...conditions)).limit(100)
    : await baseQuery.limit(100);

  return ctx.json({ data: items }, 200);
}
