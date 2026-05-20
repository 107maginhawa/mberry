import type { Context } from 'hono';
import { JobPostingRepository } from './repos/jobs.repo';

export async function searchJobPostings(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const repo = new JobPostingRepository(db);

  const filters = {
    organizationId: ctx.req.query('organizationId') ?? undefined,
    status: ctx.req.query('status') ?? undefined,
    type: ctx.req.query('type') ?? undefined,
    search: ctx.req.query('search') ?? undefined,
    limit: ctx.req.query('limit') ? Number(ctx.req.query('limit')) : 20,
    offset: ctx.req.query('offset') ? Number(ctx.req.query('offset')) : 0,
  };

  const result = await repo.list(filters);

  return ctx.json({
    data: result.data,
    pagination: {
      total: result.total,
      limit: filters.limit,
      offset: filters.offset,
    },
  }, 200);
}
