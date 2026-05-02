import type { Context } from 'hono';
import { DuesRepository } from './repos/dues.repo';
import type { Session } from '@/types/auth';

export async function listPayments(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const repo = new DuesRepository(db);

  const scope = ctx.req.query('scope');
  const orgId = ctx.req.query('organizationId');
  const status = ctx.req.query('status');
  const method = ctx.req.query('method');
  const from = ctx.req.query('from');
  const to = ctx.req.query('to');
  const limit = parseInt(ctx.req.query('limit') ?? '25', 10);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);

  const filters: any = { limit, offset };

  if (scope === 'member') {
    filters.personId = session.user.id;
  } else if (orgId) {
    filters.organizationId = orgId;
  }

  if (status) filters.status = status;
  if (method) filters.method = method;
  if (from) filters.fromDate = new Date(from);
  if (to) filters.toDate = new Date(to);

  const result = await repo.listPayments(filters);

  return ctx.json({
    data: result.data,
    meta: { total: result.total, limit, offset },
  }, 200);
}
