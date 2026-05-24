import type { Context } from 'hono';
import { CommitteeRepository } from './repos/committee.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { auditAction } from '@/utils/audit';
import type { Session } from '@/types/auth';

export async function updateCommittee(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const body = await ctx.req.json();
  const repo = new CommitteeRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Committee not found');

  if (existing.status === 'completed') {
    throw new BusinessLogicError(
      'Cannot update a dissolved committee',
      'COMMITTEE_DISSOLVED'
    );
  }

  const updated = await repo.update(id, {
    ...body,
    updatedBy: session.user.id,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'committee',
    resourceId: updated.id,
    description: `Updated committee: ${updated.name}`,
  });

  return ctx.json({ data: updated }, 200);
}
