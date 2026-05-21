import type { Context } from 'hono';
import { SurveyRepository } from './repos/survey.repo';

export async function listSurveys(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId');
  const query = ctx.req.query();

  const repo = new SurveyRepository(db);

  const result = await repo.list(orgId, {
    status: query.status,
    limit: query.limit ? Number(query.limit) : 20,
    offset: query.offset ? Number(query.offset) : 0,
  });

  return ctx.json({
    data: result.data,
    total: result.total,
    limit: query.limit ? Number(query.limit) : 20,
    offset: query.offset ? Number(query.offset) : 0,
  });
}
