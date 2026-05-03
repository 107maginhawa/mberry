import type { Context } from 'hono';
import { NotFoundError, ForbiddenError } from '@/core/errors';
import { DuesRepository } from './repos/dues.repo';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';
import type { Session } from '@/types/auth';

export async function getPayment(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id');
  const repo = new DuesRepository(db);

  const payment = await repo.getPayment(id);
  if (!payment) throw new NotFoundError('Payment not found');
  const membershipRepo = new MembershipRepository(db);
  const membership = await membershipRepo.getMember(payment.organizationId, session.user.id);
  if (!membership) throw new ForbiddenError('Access denied to this resource');

  const allocations = await repo.getFundAllocations(id);

  return ctx.json({
    data: { ...payment, fundAllocations: allocations },
  }, 200);
}
