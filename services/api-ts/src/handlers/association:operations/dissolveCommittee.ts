import type { Context } from 'hono';
import { CommitteeRepository } from './repos/committee.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { Session } from '@/types/auth';

export async function dissolveCommittee(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const body = await ctx.req.json();
  const repo = new CommitteeRepository(db);

  const existing = await repo.get(id);
  if (!existing) throw new NotFoundError('Committee not found');

  if (existing.status === 'completed') {
    throw new BusinessLogicError(
      'Committee is already dissolved',
      'COMMITTEE_ALREADY_DISSOLVED'
    );
  }

  // BR-39: dissolution retains all data read-only — repo.dissolve handles this
  const dissolved = await repo.dissolve(id, session.user.id, body.reason);

  ctx.set('auditResourceId', dissolved.id);
  ctx.set('auditDescription', `Dissolved committee: ${dissolved.name}`);
  ctx.set('auditDetails', { reason: body.reason });

  return ctx.json({ data: dissolved }, 200);
}
