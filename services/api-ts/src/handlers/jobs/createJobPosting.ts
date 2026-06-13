import type { Context } from 'hono';
import { JobPostingRepository } from './repos/jobs.repo';
import type { Session } from '@/types/auth';

export async function createJobPosting(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const body = await ctx.req.json();
  const repo = new JobPostingRepository(db);

  // FIX-003: bind the write to the tenant-resolved org from orgContextMiddleware
  // (ctx.var.organizationId), never the client-supplied body.organizationId.
  // Trusting the body allowed a member of org A to write a posting into org B.
  // Fail closed if no org context was established.
  const organizationId = ctx.get('organizationId') as string | undefined;
  if (!organizationId) {
    return ctx.json({ error: 'Organization context required' }, 403);
  }

  if (!body.title || !body.organizationName) {
    return ctx.json({ error: 'title and organizationName are required' }, 400);
  }

  const now = new Date();
  const posting = await repo.create({
    organizationId,
    title: body.title,
    organizationName: body.organizationName,
    location: body.location,
    type: body.type ?? 'full_time',
    salary: body.salary,
    description: body.description,
    requirements: body.requirements,
    postedAt: body.postedAt ? new Date(body.postedAt) : now,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    status: body.status ?? 'draft',
    postedBy: session.user.id,
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: posting }, 201);
}
