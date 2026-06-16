import type { Context } from 'hono';
import { clampPageSize } from '@/core/pagination';
import { CommitteeRepository } from './repos/committee.repo';

export async function listCommittees(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId')!;
  const repo = new CommitteeRepository(db);

  const rawLimit = ctx.req.query('limit');
  const limit = clampPageSize(rawLimit == null ? undefined : Number(rawLimit));
  const offset = Math.max(0, Number(ctx.req.query('offset')) || 0);

  const committees = await repo.list(orgId, { limit, offset });

  return ctx.json({ data: committees }, 200);
}
