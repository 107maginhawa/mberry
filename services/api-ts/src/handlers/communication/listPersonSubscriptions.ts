import type { ValidatedContext, BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListPersonSubscriptionsQuery } from '@/generated/openapi/validators';
import { requireOfficerTerm } from '@/core/auth/officer-checks';
import { PersonSubscriptionRepository } from './repos/communication.repo';

/**
 * listPersonSubscriptions
 *
 * Path: GET /association/person-subscriptions
 * OperationId: listPersonSubscriptions
 */
export async function listPersonSubscriptions(
  ctx: ValidatedContext<never, ListPersonSubscriptionsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');

  // DEC-COMMS-05 (PII scoping): person_subscription rows are consent/opt-out
  // records. The route gate is `member:owner` — ownership is enforced HERE, not
  // in middleware. A member may read only their OWN subscriptions; reading any
  // other person's requires officer access. Otherwise any member could enumerate
  // another member's consent state via ?personId=. (user.id is the caller's
  // personId — see getPerson / listDuesPayments.)
  if (query.personId !== user.id) {
    const officerDenied = await requireOfficerTerm(ctx as unknown as BaseContext);
    if (officerDenied !== null) {
      return ctx.json({ error: "Cannot access another member's subscription preferences" }, 403);
    }
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PersonSubscriptionRepository(db, logger);

  // Includes topicName so the prefs UI can map a stored topic UUID back to its
  // category and reflect the saved toggle state on reload (FIX-005 round-trip).
  const items = await repo.findByPersonWithTopic(query.personId, orgId);

  const limit = query.limit ?? query.pageSize ?? 20;
  const offset = query.offset ?? (query.page ? (query.page - 1) * limit : 0);
  const paged = items.slice(offset, offset + limit);

  // Conform to the generated PersonSubscriptionListResponseSchema contract:
  // { data, pagination }. The frontend reads `data.data`; the legacy
  // { items, total, offset, limit } shape made it permanently undefined.
  const totalCount = items.length;
  const currentPage = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  const totalPages = limit > 0 ? Math.max(1, Math.ceil(totalCount / limit)) : 1;

  return ctx.json(
    {
      data: paged,
      pagination: {
        offset,
        limit,
        count: paged.length,
        totalCount,
        totalPages,
        currentPage,
        hasNextPage: offset + paged.length < totalCount,
        hasPreviousPage: offset > 0,
      },
    },
    200,
  );
}
