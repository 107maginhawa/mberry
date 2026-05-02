import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';

export async function getPayment(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(id);
  if (!payment) throw new NotFoundError('Payment not found');

  const allocations = await repo.getFundAllocations(id);

  return ctx.json({
    data: { ...payment, fundAllocations: allocations },
  }, 200);
}
