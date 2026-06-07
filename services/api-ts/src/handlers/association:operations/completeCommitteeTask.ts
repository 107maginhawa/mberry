import type { Context } from 'hono';
import { CommitteeTaskRepository } from './repos/committee-task.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { Session } from '@/types/auth';

export async function completeCommitteeTask(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const taskRepo = new CommitteeTaskRepository(db);

  const existing = await taskRepo.get(id);
  if (!existing) throw new NotFoundError('Committee task not found');

  if (existing.status === 'completed') {
    throw new BusinessLogicError(
      'Task is already completed',
      'TASK_ALREADY_COMPLETED'
    );
  }

  const completed = await taskRepo.updateStatus(id, 'completed', session.user.id);

  ctx.set('auditResourceId', completed.id);
  ctx.set('auditDescription', `Completed task: ${completed.title}`);

  return ctx.json({ data: completed }, 200);
}
