import type { Context } from 'hono';
import { EventsRepository } from './repos/events.repo';

export async function listEvents(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId')!;
  const repo = new EventsRepository(db);
  const result = await repo.list(orgId, {
    status: ctx.req.query('status') || undefined,
    type: ctx.req.query('type') || undefined,
    search: ctx.req.query('search') || undefined,
    limit: parseInt(ctx.req.query('limit') ?? '20', 10),
    offset: parseInt(ctx.req.query('offset') ?? '0', 10),
  });
  return ctx.json({ data: result.data, meta: { total: result.total } }, 200);
}
