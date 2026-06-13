import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListBallotsQuery } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';
import { requireOfficerTerm } from '@/core/auth/officer-checks';

/**
 * listBallots
 *
 * Path: GET /association/member/ballots
 * OperationId: listBallots
 *
 * AHA FIX-003 (G3): admin-only ANONYMISED ballot search. Previously this returned raw
 * `election_vote` rows (including `voterId`) with no org scope, leaking the voter→nominee
 * linkage (secret-ballot violation, WF-077) and allowing cross-org / unscoped dumps. Now:
 *   • a ballot search must target a single election (no unscoped cross-org dump);
 *   • the caller must hold an active officer term in that election's organization;
 *   • results come from the repo's anonymised projection — `voterId` never leaves the DB.
 */
export async function listBallots(
  ctx: ValidatedContext<never, ListBallotsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  // Refuse an unscoped, cross-org dump — a ballot search must target one election.
  if (!query.electionId) return ctx.json({ data: [] }, 200);

  const election = await repo.get(query.electionId);
  if (!election) return ctx.json({ data: [] }, 200);

  // Org scope: caller must be an active officer of THIS election's organization.
  ctx.set('organizationId', election.organizationId);
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const items = await repo.listAnonymizedVotes(query.electionId, query.positionId);
  return ctx.json({ data: items }, 200);
}
