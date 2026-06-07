import type { Context } from 'hono';
import { CommitteeTaskRepository } from './repos/committee-task.repo';
import { NotFoundError } from '@/core/errors';
import type { Session } from '@/types/auth';

export async function updateCommitteeTask(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const body = await ctx.req.json();
  const taskRepo = new CommitteeTaskRepository(db);

  const existing = await taskRepo.get(id);
  if (!existing) throw new NotFoundError('Committee task not found');

  const updated = await taskRepo.update(id, {
    ...body,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    updatedBy: session.user.id,
  });

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', `Updated task: ${updated.title}`);

  return ctx.json({ data: updated }, 200);
}
