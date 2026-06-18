import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import type { ListMemberCreditsForPeerQuery } from '@/generated/openapi/validators';
import { CreditEntryRepository } from '@/handlers/association:member/repos/credits.repo';

/**
 * listMemberCreditsForPeer
 *
 * Path: GET /association/member/credits?personId=...
 *
 * Returns the public credit-entry list for a member, used to render
 * credits on a peer's directory profile card. Returns only public fields:
 * credits earned, activity name, earned date.
 *
 * Role gate: association:member (any member in the org can view another
 * member's earned credits — credits are public-by-convention in member
 * directories).
 */
export async function listMemberCreditsForPeer(
  ctx: ValidatedContext<never, ListMemberCreditsForPeerQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query') as { personId: string };
  if (!query.personId) {
    throw new ValidationError('personId query parameter is required');
  }

  // Fail-closed: the peer-credit view exposes another member's credit history,
  // so it MUST be org-scoped. A missing org context can never silently widen
  // the query into a cross-tenant PII leak — reject instead.
  const orgId = ctx.get('organizationId') as string | undefined;
  if (!orgId) {
    throw new ValidationError('organization context is required to view peer credits');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new CreditEntryRepository(db, logger);

  // Defense-in-depth: findManyForPeer hard-requires organizationId so a missing
  // org can never reach the shared optional-org buildWhereConditions guard.
  const entries = await repo.findManyForPeer(orgId, query.personId);

  const data = entries.map((e) => ({
    credits: Number(e.creditAmount ?? 0),
    courseTitle: e.activityName ?? undefined,
    earnedAt: e.activityDate
      ? (e.activityDate instanceof Date ? e.activityDate.toISOString() : String(e.activityDate))
      : undefined,
  }));

  return ctx.json({ data }, 200);
}
