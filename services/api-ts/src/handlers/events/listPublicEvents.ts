import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';

/**
 * listPublicEvents
 *
 * Path: GET /public/events
 * Public endpoint — no auth required.
 * Lists network-visibility events across all orgs. Excludes draft/cancelled.
 */
export async function listPublicEvents(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const repo = new EventsRepository(db);

  const query = ctx.req.query();
  const limit = Math.min(parseInt(query['limit'] ?? '20', 10) || 20, 50);
  const offset = parseInt(query['offset'] ?? '0', 10) || 0;

  const result = await repo.listPublic({
    eventType: query['eventType'],
    dateFrom: query['dateFrom'] ? new Date(query['dateFrom']) : undefined,
    dateTo: query['dateTo'] ? new Date(query['dateTo']) : undefined,
    pricing: query['pricing'] as 'free' | 'paid' | 'all' | undefined,
    search: query['q'],
    limit,
    offset,
  });

  return ctx.json({
    data: result.data,
    pagination: {
      total: result.total,
      limit,
      offset,
    },
  }, 200);
}
