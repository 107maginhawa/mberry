import type { Context } from 'hono';
import { JobPostingRepository } from './repos/jobs.repo';

export async function searchJobPostings(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const repo = new JobPostingRepository(db);

  // FIX-004: scope the listing to the membership-verified org resolved by
  // orgContextMiddleware (ctx.var.organizationId) by default, instead of the
  // attacker-controllable ?organizationId query param. This prevents an
  // authenticated member of org A from listing org B's postings (or all orgs
  // when the param is omitted).
  const organizationId = ctx.get('organizationId') as string | undefined;

  const filters = {
    organizationId,
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
