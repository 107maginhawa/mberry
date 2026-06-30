import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchEventRegistrationsQuery } from '@/generated/openapi/validators';
import { EventRegistrationRepository } from './repos/events.repo';

/**
 * searchEventRegistrations
 *
 * Path: GET /association/events/registrations
 * OperationId: searchEventRegistrations
 */
export async function searchEventRegistrations(
  ctx: ValidatedContext<never, SearchEventRegistrationsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRegistrationRepository(db, logger);

  const limit = Number(query.limit) || 20;
  const offset = Number(query.offset) || 0;

  // Always scope to the caller's org — a registration search must never cross tenants (a person can
  // belong to several chapters; an officer of one must not see another chapter's registrations).
  const filters: Record<string, unknown> = { organizationId: orgId };
  const q = query as Record<string, unknown>;
  if (q['eventId']) filters['eventId'] = q['eventId'];
  if (q['personId']) filters['personId'] = q['personId'];
  if (q['status']) filters['status'] = q['status'];

  const results = await repo.findMany(filters, { pagination: { limit, offset } });
  const totalCount = await repo.count(filters);

  return ctx.json({ data: results, totalCount, limit, offset }, 200);
}
