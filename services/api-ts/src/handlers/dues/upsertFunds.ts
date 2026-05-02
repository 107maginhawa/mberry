import type { Context } from 'hono';
import { ValidationError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';

export async function upsertFunds(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();
  const repo = new DuesRepository(db);

  const funds: { name: string; percentage: string; sortOrder: number }[] = body.funds;

  const total = funds.reduce((sum, f) => sum + parseFloat(f.percentage), 0);
  if (Math.abs(total - 100) > 0.001) {
    throw new ValidationError('Fund percentages must total exactly 100%');
  }

  await repo.replaceFunds(orgId, funds);

  const updated = await repo.listFunds(orgId);
  return ctx.json({ data: updated }, 200);
}
