import type { Context } from 'hono';
import { CommitteeRepository } from './repos/committee.repo';
import { CommitteeTaskRepository } from './repos/committee-task.repo';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { Session } from '@/types/auth';

export async function createCommitteeTask(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const committeeId = ctx.req.param('committeeId')!;
  const body = await ctx.req.json();

  if (!body.title) {
    return ctx.json({ error: 'title is required' }, 400);
  }

  const committeeRepo = new CommitteeRepository(db);
  const committee = await committeeRepo.get(committeeId);
  if (!committee) throw new NotFoundError('Committee not found');

  if (committee.status === 'completed') {
    throw new BusinessLogicError(
      'Cannot create tasks for a dissolved committee',
      'COMMITTEE_DISSOLVED'
    );
  }

  const taskRepo = new CommitteeTaskRepository(db);
  const task = await taskRepo.create({
    organizationId: committee.organizationId,
    committeeId,
    title: body.title,
    description: body.description ?? null,
    assigneeId: body.assigneeId ?? null,
    status: body.status ?? 'pending',
    priority: body.priority ?? 'medium',
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  ctx.set('auditResourceId', task.id);
  ctx.set('auditDescription', `Created task: ${task.title}`);

  return ctx.json({ data: task }, 201);
}
