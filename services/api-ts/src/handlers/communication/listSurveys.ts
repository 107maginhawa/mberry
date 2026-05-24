import type { Context } from 'hono';
import { SurveyRepository } from './repos/survey.repo';

export async function listSurveys(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId')!;
  const query = ctx.req.query();

  const repo = new SurveyRepository(db);

  const status = query['status'];
  const limit = query['limit'] ? Number(query['limit']) : 20;
  const offset = query['offset'] ? Number(query['offset']) : 0;

  const result = await repo.list(orgId, { status, limit, offset });

  return ctx.json({
    data: result.data,
    total: result.total,
    limit,
    offset,
  });
}
